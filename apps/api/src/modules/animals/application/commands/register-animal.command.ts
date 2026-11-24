/** Raw values from the request; the domain validates them. */
export interface RegisterAnimalCommand {
  name: string;
  species: string;
  size: string;
  ageGroup: string;
  photoUrls: string[];
  breed?: string | null;
  temperament?: string[];
  compatibleWithChildren?: boolean | null;
  compatibleWithOtherAnimals?: boolean | null;
  careNotes?: string | null;
}
