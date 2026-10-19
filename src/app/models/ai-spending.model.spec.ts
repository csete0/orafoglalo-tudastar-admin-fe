import { AI_SOURCES, sourceColor, sourceLabel } from './ai-spending.model';

describe('AI_SOURCES', () => {
  it('a tanári kód-megjegyzés javaslat forrásnak saját címkéje és színe van', () => {
    expect(sourceLabel('teacher-code-comments')).toBe('Tanár: kód-megjegyzés javaslat');
    expect(sourceColor('teacher-code-comments')).toBe('var(--series-teacher-code-comments)');
    expect(sourceLabel('team-repo-review')).toBe('Csapat: MI-repóátnézés');
  });

  it('minden forrás kulcsa és színe egyedi', () => {
    expect(new Set(AI_SOURCES.map((s) => s.key)).size).toBe(AI_SOURCES.length);
    expect(new Set(AI_SOURCES.map((s) => s.color)).size).toBe(AI_SOURCES.length);
  });
});
