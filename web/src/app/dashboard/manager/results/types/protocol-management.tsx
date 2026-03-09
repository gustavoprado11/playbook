import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { ProtocolForm } from './protocol-form';
import { ProtocolList } from './protocol-list';
import type { AssessmentProtocol, ProtocolMetric } from '@/types/database';

interface ProtocolManagementProps {
    title: string;
    description: string;
    protocols: (AssessmentProtocol & { metrics?: ProtocolMetric[] })[];
}

export function ProtocolManagement({
    title,
    description,
    protocols,
}: ProtocolManagementProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
                    <p className="mt-1 text-zinc-500">{description}</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            Novo Protocolo
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ProtocolForm />
                    </CardContent>
                </Card>

                <ProtocolList protocols={protocols} />
            </div>
        </div>
    );
}
