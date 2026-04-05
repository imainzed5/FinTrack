export const EXAMPLE_PROMPTS = [
  'spent 250 on lunch',
  '100 mrt yesterday',
  'salary 15000',
  'received 2k freelance',
] as const;

export const MOBILE_EXAMPLE_PROMPTS = EXAMPLE_PROMPTS.slice(0, 2);

export const POST_SAVE_FOLLOW_UP_CHIPS = ['Add another', 'Log income', 'Move money'] as const;

export const POST_SAVE_REPLY_INPUTS: Record<(typeof POST_SAVE_FOLLOW_UP_CHIPS)[number], string> = {
  'Add another': 'spent ',
  'Log income': 'received ',
  'Move money': 'transfer ',
};

export const STARTER_REPLY_INPUTS = {
  'Log expense': 'spent ',
  'Log income': 'received ',
  'Move money': 'transfer ',
  'Track utang': 'lent ',
} as const;

export const EMPTY_STATE_CHIPS: Array<{ label: string; value: string; mode: 'submit' | 'seed' }> = [
  { label: 'spent 250 on lunch', value: 'spent 250 on lunch', mode: 'submit' },
  { label: '100 mrt yesterday', value: '100 mrt yesterday', mode: 'submit' },
  { label: 'Log income', value: 'Log income', mode: 'seed' },
  { label: 'Track utang', value: 'Track utang', mode: 'seed' },
];
