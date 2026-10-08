'use client';

import { useState } from 'react';

/** One operation ID per form instance (design D5): every retry of this form is the same operation. */
export function useOperationId(): string {
  const [id] = useState(() => crypto.randomUUID());
  return id;
}
