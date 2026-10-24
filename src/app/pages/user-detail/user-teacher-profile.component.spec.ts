import { TestBed } from '@angular/core/testing';
import { UserTeacherProfileComponent } from './user-teacher-profile.component';
import { UserDetailTeacherProfile } from '../../services/users/user.service';

describe('UserTeacherProfileComponent', () => {
  function render(overrides: Partial<UserDetailTeacherProfile>): string[] {
    const fixture = TestBed.createComponent(UserTeacherProfileComponent);
    fixture.componentRef.setInput('profile', {
      teacherProfileId: 1, displayName: 'Tanár Úr', institutionName: 'Petőfi Gimnázium', isActive: false, maxTaskSets: 10,
      actualTaskSetCount: 3, maxStorageBytes: null, actualStorageBytes: 512, groupNames: [], schoolNames: ['Petőfi', 'Arany'],
      ...overrides,
    } satisfies UserDetailTeacherProfile);
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('dd')).map((dd) => dd.textContent?.trim() ?? '');
  }

  it('a kvótákat, a tárhelyet bájt-formázva és a listákat vesszővel mutatja', () => {
    expect(render({})).toEqual(['Tanár Úr', 'Petőfi Gimnázium', 'Letiltva', '3 / 10', '512 B / korlátlan', 'Petőfi, Arany', '-']);
    expect(render({ actualStorageBytes: 5 * 1024 * 1024, maxStorageBytes: 100 * 1024 * 1024 })[4]).toBe('5.0 MB / 100.0 MB');
  });
});
