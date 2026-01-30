import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = 'https://hgeafcvashlxtkrjqmgx.supabase.co';
const supabaseKey = 'sb_publishable_dujiQwqF0ggRwfuDFP7vhw_yoCbhdZF';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
