// prisma/seed-data.ts
//
// Dev inventory supplied by the product owner (2026-10-08): realistic
// positions with FICTIONAL people. List 1 is Paulo Freire, list 2 Carme
// Aymerich. Never put real staff here (GDPR). Production gets no inventory.
import type { HouseSlug } from '../src/lib/houses';
import type { RoleCode } from '../src/lib/roles';

export const SEED_START = '2025-09-01';

type SeedPosition = { label: string; roleCode: RoleCode; occupant: string };

export const SEED_INVENTORY: readonly { houseSlug: HouseSlug; positions: readonly SeedPosition[] }[] = [
  {
    houseSlug: 'paulo-freire',
    positions: [
      { label: 'PDG', roleCode: 'PDG', occupant: 'Meritxell Torres Vila' },
      { label: 'PSI', roleCode: 'PSI', occupant: 'Sílvia Miró Esteve' },
      { label: 'ER', roleCode: 'ER', occupant: 'Carla Ribas Solé' },
      { label: 'TFM', roleCode: 'TFM', occupant: 'Montse Molina Prat' },
      { label: 'TFT', roleCode: 'TFT', occupant: 'Noèlia Fernández Grau' },
      { label: 'ET', roleCode: 'ET', occupant: 'Roger Beltrán Camps' },
      { label: 'ECS', roleCode: 'ECS', occupant: 'Mireia Santos Rovira' },
      { label: 'EN 1', roleCode: 'EN', occupant: 'David Valls Medina' },
      { label: 'EN 2', roleCode: 'EN', occupant: 'Cristina Pascual Duran' },
      { label: 'CT', roleCode: 'CT', occupant: 'Pol Jiménez Alcover' },
    ],
  },
  {
    houseSlug: 'carme-aymerich',
    positions: [
      { label: 'PDG', roleCode: 'PDG', occupant: 'Clara Soler Pujol' },
      { label: 'PSI', roleCode: 'PSI', occupant: 'Núria Roca Ferrer' },
      { label: 'ER', roleCode: 'ER', occupant: 'Laia Vidal Mas' },
      { label: 'TFM', roleCode: 'TFM', occupant: 'Rosa Navarro Costa' },
      { label: 'TFT', roleCode: 'TFT', occupant: 'Aina Martín Serra' },
      { label: 'ET', roleCode: 'ET', occupant: 'Júlia Romero Bosch' },
      { label: 'ECS', roleCode: 'ECS', occupant: 'Berta Puig Casas' },
      { label: 'EN 1', roleCode: 'EN', occupant: 'Marc Sánchez Riera' },
      { label: 'EN 2', roleCode: 'EN', occupant: 'Irene López Font' },
      { label: 'CT', roleCode: 'CT', occupant: 'Àlex García Martí' },
    ],
  },
];
