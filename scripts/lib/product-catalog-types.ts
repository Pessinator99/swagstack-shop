export type JsonTechnique = {
  name: string;
  code: string;
  max_colors?: number | null;
  full_color?: boolean;
  is_engraving?: boolean;
  max_width_mm_override?: number;
  max_height_mm_override?: number;
};

export type JsonPrintArea = {
  name: string;
  max_width_mm: number;
  max_height_mm: number;
  is_default?: boolean;
  techniques: JsonTechnique[];
};

export type JsonVariant = {
  code: string;
  color_name: string;
  hex: string;
  main_image: string;
  logo_mockup_image?: string;
};

export type JsonProduct = {
  slug: string;
  stricker_id: string;
  name: string;
  category_slug: string;
  description: string;
  dimensions?: string;
  weight_g?: number;
  material?: string;
  country_of_origin?: string;
  moq: number;
  supplier?: string;
  volume_l?: number;
  capacity_ml?: number;
  laptop_size?: string;
  variants: JsonVariant[];
  print_areas: JsonPrintArea[];
};

export type ProductMappingFile = {
  products: JsonProduct[];
};
