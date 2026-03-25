'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Upload, X, FileText, ImageIcon } from 'lucide-react';
import type { AssessmentAttachment } from '@/types/database';

interface FileUploadProps {
    onFilesSelected: (files: File[]) => void;
    pendingFiles?: File[];
    existingFiles?: AssessmentAttachment[];
    onRemoveExisting?: (id: string) => void;
    onRemovePending?: (index: number) => void;
    maxFiles?: number;
    maxSizeBytes?: number;
    accept?: string;
}

const MAX_SIZE_DEFAULT = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
    onFilesSelected,
    pendingFiles = [],
    existingFiles = [],
    onRemoveExisting,
    onRemovePending,
    maxFiles = 5,
    maxSizeBytes = MAX_SIZE_DEFAULT,
    accept = 'image/*,.pdf',
}: FileUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const totalFiles = existingFiles.length + pendingFiles.length;
    const canAddMore = totalFiles < maxFiles;

    const validateAndAdd = useCallback((fileList: FileList | File[]) => {
        setError(null);
        const files = Array.from(fileList);
        const remaining = maxFiles - totalFiles;

        if (remaining <= 0) {
            setError(`Máximo de ${maxFiles} arquivos`);
            return;
        }

        const valid: File[] = [];
        for (const file of files.slice(0, remaining)) {
            if (!ACCEPTED_TYPES.includes(file.type)) {
                setError(`Tipo não suportado: ${file.name}`);
                continue;
            }
            if (file.size > maxSizeBytes) {
                setError(`Arquivo muito grande: ${file.name} (máx ${formatFileSize(maxSizeBytes)})`);
                continue;
            }
            valid.push(file);
        }

        if (valid.length > 0) {
            onFilesSelected(valid);
        }
    }, [maxFiles, maxSizeBytes, totalFiles, onFilesSelected]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        validateAndAdd(e.dataTransfer.files);
    }, [validateAndAdd]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            validateAndAdd(e.target.files);
            e.target.value = '';
        }
    }, [validateAndAdd]);

    return (
        <div className="space-y-3">
            {canAddMore && (
                <div
                    className={cn(
                        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors cursor-pointer',
                        dragOver
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-300'
                    )}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    <Upload className="h-5 w-5 text-zinc-400 mb-1.5" />
                    <span className="text-sm text-zinc-500">
                        Arraste fotos ou clique para selecionar
                    </span>
                    <span className="text-xs text-zinc-400 mt-0.5">
                        JPG, PNG, WebP ou PDF (máx {formatFileSize(maxSizeBytes)})
                    </span>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={accept}
                        multiple
                        className="hidden"
                        onChange={handleChange}
                    />
                </div>
            )}

            {error && (
                <p className="text-xs text-red-500">{error}</p>
            )}

            {(existingFiles.length > 0 || pendingFiles.length > 0) && (
                <div className="flex flex-wrap gap-2">
                    {existingFiles.map((file) => (
                        <FilePreview
                            key={file.id}
                            name={file.file_name}
                            type={file.file_type}
                            size={file.file_size}
                            onRemove={onRemoveExisting ? () => onRemoveExisting(file.id) : undefined}
                        />
                    ))}
                    {pendingFiles.map((file, i) => (
                        <FilePreview
                            key={`pending-${i}`}
                            name={file.name}
                            type={file.type}
                            size={file.size}
                            previewUrl={file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined}
                            onRemove={onRemovePending ? () => onRemovePending(i) : undefined}
                        />
                    ))}
                </div>
            )}

            {totalFiles > 0 && (
                <p className="text-xs text-zinc-400">
                    {totalFiles}/{maxFiles} arquivo{totalFiles !== 1 ? 's' : ''}
                </p>
            )}
        </div>
    );
}

function FilePreview({
    name,
    type,
    size,
    previewUrl,
    onRemove,
}: {
    name: string;
    type: string;
    size: number;
    previewUrl?: string;
    onRemove?: () => void;
}) {
    const isImage = type.startsWith('image/');

    return (
        <div className="relative group flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm">
            {isImage ? (
                previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt={name} className="h-8 w-8 rounded object-cover" />
                ) : (
                    <ImageIcon className="h-4 w-4 text-zinc-400" />
                )
            ) : (
                <FileText className="h-4 w-4 text-zinc-400" />
            )}
            <div className="min-w-0">
                <p className="text-xs text-zinc-700 truncate max-w-[120px]">{name}</p>
                <p className="text-xs text-zinc-400">{formatFileSize(size)}</p>
            </div>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="ml-1 rounded-full p-0.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}
