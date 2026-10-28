import { createContext } from 'react';
export const TrainingUnitsContext = createContext<{ unit: 'kg' | 'lb'; increment: number }>({ unit: 'kg', increment: 0.25 });
