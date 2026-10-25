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

  it('a védés-kérdés és a tanári szóbeli vázlat forrás címkéje a backend SourceLabels-szel egyezik, saját színnel', () => {
    expect(sourceLabel('oral-exam-defense-q')).toBe('Szóbeli vizsga: védés-kérdések');
    expect(sourceColor('oral-exam-defense-q')).toBe('var(--series-oral-exam-defense-q)');
    expect(sourceLabel('teacher-oral-draft')).toBe('Tanári szóbeli tételvázlat');
    expect(sourceColor('teacher-oral-draft')).toBe('var(--series-teacher-oral-draft)');
  });

  // UI-TT-251: a backend AiRequestSources két forrása nyers kulccsal jelent meg.
  it('az asztali feladatsor és a technikumi szempontlista forrásnak a backend SourceLabels-szel egyező címkéje és saját színe van', () => {
    expect(sourceLabel('teacher-desktop-task')).toBe('Tanár: asztali feladatsor témából');
    expect(sourceColor('teacher-desktop-task')).toBe('var(--series-teacher-desktop-task)');
    expect(sourceLabel('technikum-rubric')).toBe('Technikum: vizsgarész MI-szempontlista');
    expect(sourceColor('technikum-rubric')).toBe('var(--series-technikum-rubric)');
  });

  it('minden forrás kulcsa és színe egyedi', () => {
    expect(new Set(AI_SOURCES.map((s) => s.key)).size).toBe(AI_SOURCES.length);
    expect(new Set(AI_SOURCES.map((s) => s.color)).size).toBe(AI_SOURCES.length);
  });
});
