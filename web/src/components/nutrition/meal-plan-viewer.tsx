'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Utensils } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { NutritionMealPlan } from '@/types/database';

interface MealPlanViewerProps {
    plan: NutritionMealPlan;
    compact?: boolean;
}

export function MealPlanViewer({ plan, compact = false }: MealPlanViewerProps) {
    return (
        <Card className={plan.is_active ? 'border-emerald-300 bg-emerald-50/30' : 'border-zinc-200'}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-medium text-zinc-900">{plan.title}</CardTitle>
                        {plan.is_active && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Ativo</Badge>
                        )}
                    </div>
                    <span className="text-xs text-zinc-500">
                        {formatDate(plan.start_date)}
                        {plan.end_date && ` — ${formatDate(plan.end_date)}`}
                    </span>
                </div>
                {plan.objective && <p className="text-sm text-zinc-500 mt-1">{plan.objective}</p>}
                {(plan.total_calories || plan.protein_g || plan.carbs_g || plan.fat_g) && (
                    <div className="flex flex-wrap gap-3 mt-2 text-xs">
                        {plan.total_calories && <span className="bg-zinc-100 px-2 py-1 rounded text-zinc-700">{plan.total_calories} kcal</span>}
                        {plan.protein_g && <span className="bg-blue-50 px-2 py-1 rounded text-blue-700">P: {plan.protein_g}g</span>}
                        {plan.carbs_g && <span className="bg-amber-50 px-2 py-1 rounded text-amber-700">C: {plan.carbs_g}g</span>}
                        {plan.fat_g && <span className="bg-red-50 px-2 py-1 rounded text-red-700">G: {plan.fat_g}g</span>}
                        {plan.fiber_g && <span className="bg-green-50 px-2 py-1 rounded text-green-700">F: {plan.fiber_g}g</span>}
                    </div>
                )}
            </CardHeader>
            {!compact && plan.meals && plan.meals.length > 0 && (
                <CardContent className="space-y-3">
                    {plan.meals.map((meal, idx) => (
                        <div key={idx} className="bg-white border border-zinc-100 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Utensils className="h-4 w-4 text-emerald-600" />
                                <span className="font-medium text-sm text-zinc-900">{meal.name}</span>
                                {meal.time && (
                                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                                        <Clock className="h-3 w-3" />
                                        {meal.time}
                                    </span>
                                )}
                            </div>
                            {meal.items && meal.items.length > 0 && (
                                <ul className="space-y-1 ml-6">
                                    {meal.items.map((item, iIdx) => (
                                        <li key={iIdx} className="text-sm text-zinc-600 flex items-center gap-2">
                                            <span className="h-1 w-1 rounded-full bg-zinc-400 shrink-0" />
                                            <span>{item.food} — {item.quantity}</span>
                                            {(item.calories || item.protein) && (
                                                <span className="text-xs text-zinc-400">
                                                    ({item.calories && `${item.calories}kcal`}{item.protein && ` P:${item.protein}g`}{item.carbs && ` C:${item.carbs}g`}{item.fat && ` G:${item.fat}g`})
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {meal.notes && <p className="text-xs text-zinc-500 mt-1 ml-6">{meal.notes}</p>}
                        </div>
                    ))}
                    {plan.notes && (
                        <div className="text-sm text-zinc-500 border-t border-zinc-100 pt-2">
                            <span className="font-medium text-zinc-700">Obs:</span> {plan.notes}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
