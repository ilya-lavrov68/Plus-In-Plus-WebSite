/**
 * Server actions for the admin panel and the auth modal.
 *
 * - auth:    registerUser
 * - services: createService, updateService, deleteService
 * - posts:   createPost, updatePost, deletePost
 */
export { registerUser } from "@/app/actions/auth";
export type { RegisterInput, RegisterResult } from "@/app/actions/auth";

export { createService, updateService, deleteService } from "@/app/actions/services";
export type { ServiceActionResult } from "@/app/actions/services";

export { createPost, updatePost, deletePost } from "@/app/actions/posts";
export type { PostActionResult } from "@/app/actions/posts";
