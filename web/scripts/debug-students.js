
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually read .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envConfig = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envConfig[key.trim()] = value.trim();
    }
});

const supabaseUrl = envConfig['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = envConfig['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseServiceKey);

async function checkStudents() {
    console.log('Checking students table...');
    const { data, error } = await sb.from('students').select('*');
    if (error) {
        console.error('Error fetching students:', error);
    } else {
        console.log('Students in DB:', data);
        console.log('Total count:', data.length);
    }
}

checkStudents();
