import { PostForm } from "@/components/admin/post-form";

export const dynamic = "force-dynamic";

export default function NewPostPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">New post</h1>
      <p className="mt-2 text-muted-foreground">
        The cover is uploaded to /public/uploads/blog/ and its path is saved in the database.
      </p>
      <div className="mt-8">
        <PostForm mode="create" />
      </div>
    </div>
  );
}
