export type Organization = {
  id: string;
  name: string;
  slug: string;
  type?: "hospital" | "clinic" | "group" | "other";
  createdAt: string;
  updatedAt: string;
};
