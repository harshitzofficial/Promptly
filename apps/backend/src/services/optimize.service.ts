export function regexCompress(text: string): string {
  let compressed = text;
  const fillers = [
    // Politeness & Fluff
    /\b(please|kindly|could you|would you|can you|would you mind|if it's not too much trouble|I was wondering if|I would like you to|make sure to|it would be great if)\b/gi,
    /\b(I need you to|I want you to|I am looking for|I am trying to|I just wanted to ask|I would appreciate it if you could)\b/gi,
    /\b(feel free to|let me know if|don't hesitate to|thank you in advance|thanks|thanks so much)\b/gi,
    // Weak modifiers & hedges
    /\b(basically|essentially|actually|really|very|just|literally|simply|pretty much|somewhat|sort of|kind of)\b/gi,
    // Redundant transitions
    /\b(as a matter of fact|in fact|in other words|to put it another way|needless to say)\b/gi
  ];
  for (const regex of fillers) compressed = compressed.replace(regex, '');
  compressed = compressed.replace(/\n{3,}/g, '\n\n');
  compressed = compressed.replace(/[ \t]{2,}/g, ' ');
  return compressed.trim();
}
