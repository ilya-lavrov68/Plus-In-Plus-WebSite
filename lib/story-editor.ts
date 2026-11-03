import { randomUUID } from "node:crypto";

import { withTransaction } from "@/lib/db";
import { normalizeStoryContent, STORY_CONTENT_LIMITS } from "@/lib/story-content";

/**
 * Редактирование блока «история студии».
 *
 * Публичная страница читает таблицы `story` и `story_events`, поэтому админка
 * пишет именно их. Валидация общая с чтением — `normalizeStoryContent`:
 * ограничения длины, запрет управляющих символов, не больше 20 вех.
 */

export class StoryRuleError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "StoryRuleError";
  }
}

export interface StoryEventInput {
  id?: string;
  period: string;
  title: string;
  description: string;
}

export interface StoryInput {
  heading: string;
  description: string;
  events: StoryEventInput[];
}

/** Пересобирает список вех: пустые строки формы отбрасываются. */
export function prepareStory(input: StoryInput) {
  const events = input.events
    .map((event) => ({
      id: event.id?.trim() || randomUUID(),
      period: event.period.trim(),
      title: event.title.trim(),
      description: event.description.trim(),
    }))
    // Пустая веха — это не «веха без текста», а незаполненная строка формы.
    .filter((event) => event.period || event.title || event.description);

  if (events.length > STORY_CONTENT_LIMITS.events) {
    throw new StoryRuleError(`Не больше ${STORY_CONTENT_LIMITS.events} вех.`, "too_many_events");
  }

  const content = normalizeStoryContent({
    heading: input.heading.trim(),
    description: input.description.trim(),
    events,
  });
  if (!content) {
    throw new StoryRuleError(
      "Проверьте поля: заголовки короче лимитов, у каждой вехи нужны период, название и описание.",
      "invalid_content",
    );
  }
  return content;
}

export async function saveStory(input: StoryInput): Promise<void> {
  const content = prepareStory(input);
  const now = new Date().toISOString();

  await withTransaction(async (tx) => {
    const [current] = await tx.rows<{ id: string }>(
      `select id from story order by created_at limit 1`,
    );
    const storyId = current?.id ?? randomUUID();

    if (current) {
      await tx.run(`update story set heading = ?, description = ?, updated_at = ? where id = ?`, [
        content.heading,
        content.description,
        now,
        storyId,
      ]);
    } else {
      await tx.run(
        `insert into story (id, heading, description, created_at, updated_at) values (?, ?, ?, ?, ?)`,
        [storyId, content.heading, content.description, now, now],
      );
    }

    // Состав вех переписывается целиком: порядок в форме — это и есть порядок
    // на странице, а частичное обновление оставляло бы «хвосты» после удаления.
    await tx.run(`delete from story_events where _parent_id = ?`, [storyId]);
    for (const [index, event] of content.events.entries()) {
      await tx.run(
        `insert into story_events (_order, _parent_id, id, period, title, description) values (?, ?, ?, ?, ?, ?)`,
        [index + 1, storyId, event.id, event.period, event.title, event.description],
      );
    }
  });
}
