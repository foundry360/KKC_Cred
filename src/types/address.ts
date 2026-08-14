export type Gender =
  | "male"
  | "female"
  | "non_binary"
  | "prefer_not_to_say"
  | "unknown";

export type AddressType = "home" | "work" | "mailing";

export type ProviderAddress = {
  id: string;
  externalId: string;
  providerId: string;
  addressType: AddressType;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};
