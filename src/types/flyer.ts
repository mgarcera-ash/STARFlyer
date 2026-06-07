export type Hotspot = {
  type: "phone" | "sms" | "email" | "address" | "website";
  label?: string;
  value: string;
};

export type Flyer = {
  id: string;
  title: string;
  entity: string | null;
  description: string | null;
  tags: string[] | null;
  image_url: string | null;
  status: string;
  created_at: string | null;
  approved_at: string | null;
  hotspots: Hotspot[] | null;
  featured: boolean;
  top_pick: boolean;
};
