// scripts/initializeQuoteCounter.ts
// Run this script once to initialize the quote counter in Supabase
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const settingsTable = supabase.from('settings');

async function initializeQuoteCounter() {
  try {
    console.log('Initializing quote counter...');

    const { data: existingSettings, error: selectError } = await settingsTable
      .select('lastQuoteNumber')
      .eq('id', 'app_settings')
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError;
    }

    if (!existingSettings) {
      const { error: insertError } = await settingsTable.insert({
        id: 'app_settings',
        lastQuoteNumber: 1000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (insertError) {
        throw insertError;
      }
      console.log('Settings document created successfully with starting quote number: 1000');
    } else {
      console.log('Settings document already exists');
    }

    console.log('Quote counter initialization complete!');
  } catch (error) {
    console.error('Error initializing quote counter:', error);
    throw error;
  }
}

initializeQuoteCounter()
  .then(() => {
    console.log('Quote counter initialization complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Initialization failed:', error);
    process.exit(1);
  });
