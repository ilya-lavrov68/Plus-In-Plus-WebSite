/**
 * Canonical article copy transcribed from the supplied Plus In Plus Blog PDF.
 * It is used only when the matching reference post exists in the published DB.
 */
export interface SampleArticleSection {
  title: string;
  subtitle?: string;
  paragraphs: string[];
}

export interface SampleArticle {
  title: string;
  lead: string;
  sections: SampleArticleSection[];
  closing: string;
}

export const SAMPLE_ARTICLE: SampleArticle = {
  title: "We're Up and Running",
  lead:
    "We’ve long wanted to bring together in one place everything that Plus In Plus has become: our approach, our services, and the projects through which we put ideas to the test. Now our new website is live—and it’s more than just an updated showcase. It’s a clearer story of how we help products become cohesive and ready for growth.",
  sections: [
    {
      title: "It's Not Just About Design",
      paragraphs: [
        "Plus In Plus began with a desire to make ideas clear and expressive. Over time, it became clear that a visual solution alone wasn’t enough. For a product to work, you need to tie together its goals, user experience, interface, and technological foundation.",
        "That’s why today we take a broader view of the task—from the initial questions about the product to design, design systems, and front-end development. We care not only about how a single screen looks, but also about how all parts of the product work together.",
      ],
    },
    {
      title: "Why We Needed a New Website",
      subtitle:
        "The website was meant to answer a simple question: how can Plus In Plus be useful to your team?",
      paragraphs: [
        "We restructured the site to immediately highlight our main areas of focus: web design and UX, design systems, and front-end development. We also highlighted our systematic approach—where a solution helps not only launch a product but also develop it further.",
        "The visual language also became part of this narrative: clean typography, white space, and precise details create a sense of clarity rather than clutter. And snippets of interfaces and projects allow visitors to see our approach in context.",
      ],
    },
    {
      title: "Experience That Grows Alongside Our Products",
      paragraphs: [
        "An important part of our work consists of our own projects and ecosystems: Ozone and Plus For Play. They help us view a product not just through a single mockup, but through real-world scenarios, user feedback, and iterative development.",
        "This experience shapes how we approach new challenges: first, we understand the context; then, we build a clear system of solutions; and only then do we move on to implementation.",
      ],
    },
    {
      title: "What's Next",
      paragraphs: [
        "Launching a website isn’t the end—it’s the beginning of the next phase. We’ll be adding case studies, articles on design and development, and new insights from our product practice.",
        "If you have an idea that needs to be turned into a clear and scalable product—tell us about it. Let’s discuss the best place to start.",
      ],
    },
  ],
  closing: "The new Plus In Plus website is now live. Welcome.",
};
