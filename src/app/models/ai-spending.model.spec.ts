import { AI_SOURCES, sourceColor, sourceLabel } from './ai-spending.model';

describe('AI_SOURCES', () => {
  it('a tanári kód-megjegyzés javaslat forrásnak saját címkéje és színe van', () => {
    expect(sourceLabel('teacher-code-comments')).toBe('Tanár: kód-megjegyzés javaslat');
    expect(sourceColor('teacher-code-comments')).toBe('var(--series-teacher-code-comments)');
    expect(sourceLabel('team-repo-review')).toBe('Csapat: MI-repóátnézés');
  });

  it('a szóbeli vizsga két forrásának a backend SourceLabels-szel egyező címkéje és saját színe van', () => {
    expect(sourceLabel('oral-exam-voice')).toBe('Szóbeli vizsga: hang (OpenAI)');
    expect(sourceColor('oral-exam-voice')).toBe('var(--series-oral-exam-voice)');
    expect(sourceLabel('oral-exam-grading')).toBe('Szóbeli vizsga: értékelés');
    expect(sourceColor('oral-exam-grading')).toBe('var(--series-oral-exam-grading)');
  });

  it('minden forrás kulcsa és színe egyedi', () => {
    expect(new Set(AI_SOURCES.map((s) => s.key)).size).toBe(AI_SOURCES.length);
    expect(new Set(AI_SOURCES.map((s) => s.color)).size).toBe(AI_SOURCES.length);
  });
});
