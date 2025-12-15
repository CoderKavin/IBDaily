/**
 * Supabase Seed Script
 * Run with: npx tsx scripts/seed.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// IB Subject Catalog
const subjects = [
  // Group 1: Studies in Language and Literature
  { subject_code: 'ENG_A_LAL', transcript_name: 'English A: Lang & Lit', full_name: 'English A: Language and Literature', group_name: 'Studies in Language and Literature', group_number: 1, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'ENG_A_LIT', transcript_name: 'English A: Literature', full_name: 'English A: Literature', group_name: 'Studies in Language and Literature', group_number: 1, sl_available: true, hl_available: true, has_units: true },

  // Group 2: Language Acquisition
  { subject_code: 'FRENCH_B', transcript_name: 'French B', full_name: 'French B', group_name: 'Language Acquisition', group_number: 2, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'SPANISH_B', transcript_name: 'Spanish B', full_name: 'Spanish B', group_name: 'Language Acquisition', group_number: 2, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'SPANISH_AB', transcript_name: 'Spanish Ab Initio', full_name: 'Spanish Ab Initio', group_name: 'Language Acquisition', group_number: 2, sl_available: true, hl_available: false, has_units: true },
  { subject_code: 'MANDARIN_B', transcript_name: 'Mandarin B', full_name: 'Mandarin B', group_name: 'Language Acquisition', group_number: 2, sl_available: true, hl_available: true, has_units: true },

  // Group 3: Individuals and Societies
  { subject_code: 'HISTORY', transcript_name: 'History', full_name: 'History', group_name: 'Individuals and Societies', group_number: 3, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'GEOGRAPHY', transcript_name: 'Geography', full_name: 'Geography', group_name: 'Individuals and Societies', group_number: 3, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'ECONOMICS', transcript_name: 'Economics', full_name: 'Economics', group_name: 'Individuals and Societies', group_number: 3, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'PSYCHOLOGY', transcript_name: 'Psychology', full_name: 'Psychology', group_name: 'Individuals and Societies', group_number: 3, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'BUS_MGMT', transcript_name: 'Business Management', full_name: 'Business Management', group_name: 'Individuals and Societies', group_number: 3, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'GLOBAL_POL', transcript_name: 'Global Politics', full_name: 'Global Politics', group_name: 'Individuals and Societies', group_number: 3, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'ESS', transcript_name: 'Env Systems & Societies', full_name: 'Environmental Systems and Societies', group_name: 'Individuals and Societies', group_number: 3, sl_available: true, hl_available: false, has_units: true },

  // Group 4: Sciences
  { subject_code: 'PHYSICS', transcript_name: 'Physics', full_name: 'Physics', group_name: 'Sciences', group_number: 4, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'CHEMISTRY', transcript_name: 'Chemistry', full_name: 'Chemistry', group_name: 'Sciences', group_number: 4, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'BIOLOGY', transcript_name: 'Biology', full_name: 'Biology', group_name: 'Sciences', group_number: 4, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'COMP_SCI', transcript_name: 'Computer Science', full_name: 'Computer Science', group_name: 'Sciences', group_number: 4, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'DESIGN_TECH', transcript_name: 'Design Technology', full_name: 'Design Technology', group_name: 'Sciences', group_number: 4, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'SPORTS_SCI', transcript_name: 'Sports, Exercise & Health Sci', full_name: 'Sports, Exercise and Health Science', group_name: 'Sciences', group_number: 4, sl_available: true, hl_available: true, has_units: true },

  // Group 5: Mathematics
  { subject_code: 'MATH_AA', transcript_name: 'Math: Analysis & Approaches', full_name: 'Mathematics: Analysis and Approaches', group_name: 'Mathematics', group_number: 5, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'MATH_AI', transcript_name: 'Math: Applications & Interp', full_name: 'Mathematics: Applications and Interpretation', group_name: 'Mathematics', group_number: 5, sl_available: true, hl_available: true, has_units: true },

  // Group 6: The Arts
  { subject_code: 'VISUAL_ARTS', transcript_name: 'Visual Arts', full_name: 'Visual Arts', group_name: 'The Arts', group_number: 6, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'MUSIC', transcript_name: 'Music', full_name: 'Music', group_name: 'The Arts', group_number: 6, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'THEATRE', transcript_name: 'Theatre', full_name: 'Theatre', group_name: 'The Arts', group_number: 6, sl_available: true, hl_available: true, has_units: true },
  { subject_code: 'FILM', transcript_name: 'Film', full_name: 'Film', group_name: 'The Arts', group_number: 6, sl_available: true, hl_available: true, has_units: true },
];

// Units for common subjects
const subjectUnits: Record<string, { name: string; level_scope: string }[]> = {
  PHYSICS: [
    { name: 'Measurements and Uncertainties', level_scope: 'BOTH' },
    { name: 'Mechanics', level_scope: 'BOTH' },
    { name: 'Thermal Physics', level_scope: 'BOTH' },
    { name: 'Waves', level_scope: 'BOTH' },
    { name: 'Electricity and Magnetism', level_scope: 'BOTH' },
    { name: 'Circular Motion and Gravitation', level_scope: 'BOTH' },
    { name: 'Atomic, Nuclear and Particle Physics', level_scope: 'BOTH' },
    { name: 'Energy Production', level_scope: 'BOTH' },
    { name: 'Wave Phenomena', level_scope: 'HL' },
    { name: 'Fields', level_scope: 'HL' },
    { name: 'Electromagnetic Induction', level_scope: 'HL' },
    { name: 'Quantum and Nuclear Physics', level_scope: 'HL' },
  ],
  CHEMISTRY: [
    { name: 'Stoichiometric Relationships', level_scope: 'BOTH' },
    { name: 'Atomic Structure', level_scope: 'BOTH' },
    { name: 'Periodicity', level_scope: 'BOTH' },
    { name: 'Chemical Bonding and Structure', level_scope: 'BOTH' },
    { name: 'Energetics/Thermochemistry', level_scope: 'BOTH' },
    { name: 'Chemical Kinetics', level_scope: 'BOTH' },
    { name: 'Equilibrium', level_scope: 'BOTH' },
    { name: 'Acids and Bases', level_scope: 'BOTH' },
    { name: 'Redox Processes', level_scope: 'BOTH' },
    { name: 'Organic Chemistry', level_scope: 'BOTH' },
    { name: 'Measurement and Data Processing', level_scope: 'BOTH' },
  ],
  BIOLOGY: [
    { name: 'Cell Biology', level_scope: 'BOTH' },
    { name: 'Molecular Biology', level_scope: 'BOTH' },
    { name: 'Genetics', level_scope: 'BOTH' },
    { name: 'Ecology', level_scope: 'BOTH' },
    { name: 'Evolution and Biodiversity', level_scope: 'BOTH' },
    { name: 'Human Physiology', level_scope: 'BOTH' },
    { name: 'Nucleic Acids', level_scope: 'HL' },
    { name: 'Metabolism, Cell Respiration and Photosynthesis', level_scope: 'HL' },
    { name: 'Plant Biology', level_scope: 'HL' },
    { name: 'Genetics and Evolution', level_scope: 'HL' },
    { name: 'Animal Physiology', level_scope: 'HL' },
  ],
  MATH_AA: [
    { name: 'Number and Algebra', level_scope: 'BOTH' },
    { name: 'Functions', level_scope: 'BOTH' },
    { name: 'Geometry and Trigonometry', level_scope: 'BOTH' },
    { name: 'Statistics and Probability', level_scope: 'BOTH' },
    { name: 'Calculus', level_scope: 'BOTH' },
  ],
  MATH_AI: [
    { name: 'Number and Algebra', level_scope: 'BOTH' },
    { name: 'Functions', level_scope: 'BOTH' },
    { name: 'Geometry and Trigonometry', level_scope: 'BOTH' },
    { name: 'Statistics and Probability', level_scope: 'BOTH' },
    { name: 'Calculus', level_scope: 'BOTH' },
  ],
  ECONOMICS: [
    { name: 'Introduction to Economics', level_scope: 'BOTH' },
    { name: 'Microeconomics', level_scope: 'BOTH' },
    { name: 'Macroeconomics', level_scope: 'BOTH' },
    { name: 'The Global Economy', level_scope: 'BOTH' },
  ],
  PSYCHOLOGY: [
    { name: 'Biological Approach', level_scope: 'BOTH' },
    { name: 'Cognitive Approach', level_scope: 'BOTH' },
    { name: 'Sociocultural Approach', level_scope: 'BOTH' },
    { name: 'Research Methodology', level_scope: 'BOTH' },
    { name: 'Abnormal Psychology', level_scope: 'BOTH' },
    { name: 'Human Relationships', level_scope: 'BOTH' },
  ],
  HISTORY: [
    { name: 'Military Leaders', level_scope: 'BOTH' },
    { name: 'Conquest and Expansion', level_scope: 'BOTH' },
    { name: 'Rise and Fall of States', level_scope: 'BOTH' },
    { name: 'Independence Movements', level_scope: 'BOTH' },
    { name: 'Authoritarian States', level_scope: 'BOTH' },
    { name: 'Causes of Conflicts', level_scope: 'BOTH' },
    { name: 'Cold War', level_scope: 'BOTH' },
  ],
};

async function seed() {
  console.log('Starting seed...\n');

  // Seed subjects
  console.log('Seeding subjects...');
  for (const subject of subjects) {
    const { data, error } = await supabase
      .from('subjects')
      .upsert(subject, { onConflict: 'subject_code' })
      .select()
      .single();

    if (error) {
      console.error(`Error seeding subject ${subject.subject_code}:`, error.message);
    } else {
      console.log(`  - ${subject.transcript_name}`);

      // Seed units for this subject if available
      const units = subjectUnits[subject.subject_code];
      if (units && data) {
        for (let i = 0; i < units.length; i++) {
          const unit = units[i];
          const { error: unitError } = await supabase
            .from('units')
            .upsert(
              {
                subject_id: data.id,
                name: unit.name,
                order_index: i + 1,
                level_scope: unit.level_scope,
              },
              { onConflict: 'subject_id,order_index' }
            );

          if (unitError) {
            console.error(`    Error seeding unit "${unit.name}":`, unitError.message);
          } else {
            console.log(`    - Unit ${i + 1}: ${unit.name}`);
          }
        }
      }
    }
  }

  console.log('\nSeed completed!');
}

seed().catch(console.error);
