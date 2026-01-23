
'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export function DebugStudents() {
    const [status, setStatus] = useState('loading');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        async function check() {
            const supabase = createClient();

            // Check session
            const { data: { session } } = await supabase.auth.getSession();
            console.log('Session:', session);

            // Check students
            const { data, error } = await supabase
                .from('students')
                .select('*');

            if (error) {
                setError(error);
                setStatus('error');
            } else {
                setResult(data);
                setStatus('success');
            }
        }
        check();
    }, []);

    if (process.env.NODE_ENV === 'production') return null;

    return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg my-4 text-xs font-mono">
            <h3 className="font-bold">Debug Info</h3>
            <div className="mb-2">Status: {status}</div>
            {error && <div className="text-red-600">{JSON.stringify(error, null, 2)}</div>}
            {result && <div>Found: {result.length} students</div>}
            <details>
                <summary>Data</summary>
                <pre>{JSON.stringify(result, null, 2)}</pre>
            </details>
        </div>
    );
}
