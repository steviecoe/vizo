'use client';

import { useState } from 'react';

const AI_LIMITATIONS = [
  {
    title: 'Hand & finger quality',
    description: 'AI may produce extra or distorted fingers. Review hands closely before approving.',
  },
  {
    title: 'Fabric clipping',
    description: 'Garments may clip through model limbs or appear incorrectly layered in complex poses.',
  },
  {
    title: 'Text & logos',
    description: 'Printed text, brand logos, and fine patterns may appear garbled or illegible.',
  },
  {
    title: 'Symmetry',
    description: 'Earrings, sleeves, and other paired items may not be perfectly symmetrical.',
  },
  {
    title: 'Background consistency',
    description: 'Studio props and background elements may shift between variants of the same shoot.',
  },
];

export function AiLimitationsTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
        aria-expanded={open}
        aria-label="AI limitations info"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        AI Limitations
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-stone-200 bg-white p-4 shadow-lg"
          role="tooltip"
        >
          <h3 className="text-sm font-semibold font-display text-stone-900">Known AI Limitations</h3>
          <p className="mt-1 text-xs text-stone-500">
            AI image generation has known limitations. Always review generated images before approving.
          </p>
          <ul className="mt-3 space-y-2">
            {AI_LIMITATIONS.map((item) => (
              <li key={item.title} className="text-xs">
                <span className="font-medium text-stone-800">{item.title}:</span>{' '}
                <span className="text-stone-600">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
