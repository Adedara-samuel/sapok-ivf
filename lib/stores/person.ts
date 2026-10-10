import { personSchema, fullName, type Person } from "@/lib/schemas/person";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { nowIso } from "@/lib/utils/dates";
import { newId, nextSequence } from "@/lib/utils/ids";

export type PersonInput = Omit<Person, "id" | "prn" | "createdAt">;

export class DuplicatePersonError extends DomainError {
  readonly match: Person;

  constructor(match: Person) {
    super(`${fullName(match)} (${match.prn}) is already registered with the same date of birth and phone number.`);
    this.name = "DuplicatePersonError";
    this.match = match;
  }
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

export function findDuplicatePerson(
  persons: readonly Person[],
  input: Pick<Person, "firstName" | "lastName" | "dob" | "phone">,
): Person | undefined {
  return persons.find(
    (p) =>
      norm(p.firstName) === norm(input.firstName) &&
      norm(p.lastName) === norm(input.lastName) &&
      p.dob === input.dob &&
      p.phone === input.phone,
  );
}

export function prnPrefix(branchId: string): string {
  return `PRN-${branchId.replace("-", "")}-`;
}

export interface PersonState {
  persons: Person[];
  register: (input: PersonInput, options?: { allowDuplicate?: boolean }) => Person;
  update: (id: string, patch: Partial<PersonInput>) => Person;
  reset: (seed: SeedData) => void;
}

export const usePersonStore = createDomainStore<PersonState>("persons", (set, get) => ({
  persons: [],
  register: (input, options = {}) => {
    const duplicate = findDuplicatePerson(get().persons, input);
    if (duplicate && !options.allowDuplicate) throw new DuplicatePersonError(duplicate);
    const prefix = prnPrefix(input.branchId);
    const person = validate(personSchema, {
      ...input,
      id: newId("PT"),
      prn: nextSequence(
        get().persons.map((p) => p.prn),
        prefix,
        6,
      ),
      createdAt: nowIso(),
    });
    set((s) => {
      s.persons.push(person);
    });
    audit("create", "patient", `Registered ${fullName(person)} (${person.prn})`, person.id);
    return person;
  },
  update: (id, patch) => {
    const current = get().persons.find((p) => p.id === id);
    if (!current) throw new DomainError("Person not found");
    const next = validate(personSchema, { ...current, ...patch });
    set((s) => {
      const idx = s.persons.findIndex((p) => p.id === id);
      s.persons[idx] = next;
    });
    audit("update", "patient", `Updated details of ${fullName(next)} (${next.prn})`, id);
    return next;
  },
  reset: (seed) =>
    set((s) => {
      s.persons = seed.persons;
    }),
}));
