import { createContext } from 'react';
import type { Accent } from './accent';

/** Separate from settings to keep theme usable before authentication and in isolated UI. */
export const AccentContext = createContext<Accent>('lime');
