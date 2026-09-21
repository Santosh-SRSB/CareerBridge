'use client';

import { useState, type ReactNode } from 'react';
import { SkillSearchCombobox } from '@/components/resume/SkillSearchCombobox';
import {
  DegreeSelect,
  FieldOfStudySelect,
  InstitutionCombobox,
} from '@/components/resume/EducationSelectors';
import { MonthField, MonthRangeFields } from '@/components/resume/ResumeFormFields';
import { formatEducationYearRange, formatMonthRange } from '@/lib/resume-dates';
import { splitProjectFields } from '@/features/resume/project-fields';

const formStyles = `
  .cb-inline-form {
    border: 1.5px solid var(--line, #dde0d3);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    background: #fafaf8;
  }
  .cb-inline-form h3 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 700;
    color: var(--ink, #142a4f);
  }
  .cb-inline-form .cb-field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .cb-inline-form .cb-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cb-inline-form .cb-field.full { grid-column: 1 / -1; }
  .cb-inline-form label {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-70, #43526b);
  }
  .cb-inline-form input:not([type="month"]):not([type="checkbox"]),
  .cb-inline-form select,
  .cb-inline-form textarea {
    border: 1.5px solid var(--line, #dde0d3);
    border-radius: 8px;
    padding: 9px 11px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    width: 100%;
    box-sizing: border-box;
  }
  .cb-inline-form textarea { min-height: 72px; resize: vertical; }
  .cb-inline-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .cb-inline-form-btn {
    padding: 9px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-family: 'Inter', sans-serif;
  }
  .cb-inline-form-btn-save { background: #142a4f; color: #fff; }
  .cb-inline-form-btn-cancel {
    background: transparent;
    color: #142a4f;
    border: 1.5px solid #dde0d3;
  }
  .cb-bullet-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    align-items: flex-start;
  }
  .cb-bullet-row input { flex: 1; }
  .cb-bullet-remove {
    background: none;
    border: none;
    color: #6b7789;
    cursor: pointer;
    font-size: 18px;
    padding: 6px;
    line-height: 1;
  }
  @media (max-width: 600px) {
    .cb-inline-form .cb-field-grid { grid-template-columns: 1fr; }
  }
`;

function FormShell({
  title,
  onCancel,
  onSave,
  children,
  saveLabel = 'Save',
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
  saveLabel?: string;
}) {
  return (
    <div className="cb-inline-form">
      <style dangerouslySetInnerHTML={{ __html: formStyles }} />
      <h3>{title}</h3>
      {children}
      <div className="cb-inline-form-actions">
        <button type="button" className="cb-inline-form-btn cb-inline-form-btn-save" onClick={onSave}>
          {saveLabel}
        </button>
        <button type="button" className="cb-inline-form-btn cb-inline-form-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export interface EducationFormData {
  degree: string;
  field: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  grade: string;
  gradeType: string;
}

export function EducationInlineForm({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (data: EducationFormData) => void;
  onCancel: () => void;
  initial?: Partial<EducationFormData>;
}) {
  const editing = Boolean(initial);
  const [degree, setDegree] = useState(initial?.degree || '');
  const [field, setField] = useState(initial?.field || '');
  const [institution, setInstitution] = useState(initial?.institution || '');
  const [startDate, setStartDate] = useState(initial?.startDate || '');
  const [endDate, setEndDate] = useState(initial?.endDate || '');
  const [isCurrent, setIsCurrent] = useState(Boolean(initial?.isCurrent));
  const [grade, setGrade] = useState(initial?.grade || '');
  const [gradeType, setGradeType] = useState(initial?.gradeType || 'CGPA');

  return (
    <FormShell
      title={editing ? 'Edit education' : 'Add education'}
      onCancel={onCancel}
      onSave={() =>
        degree.trim() &&
        onSave({ degree, field, institution, location: '', startDate, endDate, isCurrent, grade, gradeType })
      }
      saveLabel={degree.trim() ? (editing ? 'Save changes' : 'Add education') : 'Enter degree'}
    >
      <div className="cb-field-grid">
        <div className="cb-field">
          <DegreeSelect value={degree} onChange={setDegree} />
        </div>
        <div className="cb-field">
          <FieldOfStudySelect value={field} onChange={setField} />
        </div>
        <div className="cb-field full">
          <InstitutionCombobox value={institution} onChange={setInstitution} />
        </div>
        <div className="cb-field full">
          <MonthRangeFields
            startLabel="Start date"
            endLabel="End date"
            start={startDate}
            end={endDate}
            isCurrent={isCurrent}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
            onCurrentChange={setIsCurrent}
            presentLabel="Currently studying here"
          />
        </div>
        <div className="cb-field">
          <label>Grade type</label>
          <input value={gradeType} onChange={(e) => setGradeType(e.target.value)} placeholder="CGPA" />
        </div>
        <div className="cb-field">
          <label>Grade</label>
          <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="8.0" />
        </div>
      </div>
    </FormShell>
  );
}

export interface ExperienceFormData {
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string[];
}

export function ExperienceInlineForm({
  defaultLocation,
  onSave,
  onCancel,
  initial,
}: {
  defaultLocation?: string;
  onSave: (data: ExperienceFormData) => void;
  onCancel: () => void;
  initial?: Partial<ExperienceFormData>;
}) {
  const editing = Boolean(initial);
  const [role, setRole] = useState(initial?.role || '');
  const [company, setCompany] = useState(initial?.company || '');
  const [location, setLocation] = useState(initial?.location || defaultLocation || '');
  const [startDate, setStartDate] = useState(initial?.startDate || '');
  const [endDate, setEndDate] = useState(initial?.endDate || '');
  const [isCurrent, setIsCurrent] = useState(Boolean(initial?.isCurrent));
  const [responsibilities, setResponsibilities] = useState<string[]>(
    initial?.responsibilities?.length ? [...initial.responsibilities] : [''],
  );

  function updateBullet(i: number, value: string) {
    setResponsibilities((prev) => prev.map((b, idx) => (idx === i ? value : b)));
  }

  return (
    <FormShell
      title={editing ? 'Edit experience' : 'Add experience'}
      onCancel={onCancel}
      onSave={() =>
        role.trim() &&
        onSave({
          role,
          company,
          location,
          startDate,
          endDate,
          isCurrent,
          responsibilities: responsibilities.filter((r) => r.trim()),
        })
      }
      saveLabel={role.trim() ? (editing ? 'Save changes' : 'Add experience') : 'Enter job title'}
    >
      <div className="cb-field-grid">
        <div className="cb-field">
          <label>Job title *</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Software Developer" />
        </div>
        <div className="cb-field">
          <label>Company</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" />
        </div>
        <div className="cb-field full">
          <label>Work location (optional)</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Kochi, Kerala"
          />
        </div>
        <div className="cb-field full">
          <MonthRangeFields
            start={startDate}
            end={endDate}
            isCurrent={isCurrent}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
            onCurrentChange={setIsCurrent}
            presentLabel="Currently working here"
          />
        </div>
        <div className="cb-field full">
          <label>Responsibilities</label>
          {responsibilities.map((bullet, i) => (
            <div key={i} className="cb-bullet-row">
              <input
                value={bullet}
                onChange={(e) => updateBullet(i, e.target.value)}
                placeholder="Describe a responsibility or achievement"
              />
              {responsibilities.length > 1 && (
                <button
                  type="button"
                  className="cb-bullet-remove"
                  onClick={() => setResponsibilities((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="cb-inline-form-btn cb-inline-form-btn-cancel"
            style={{ marginTop: 4 }}
            onClick={() => setResponsibilities((prev) => [...prev, ''])}
          >
            + Add bullet
          </button>
        </div>
      </div>
    </FormShell>
  );
}

export interface ProjectFormData {
  name: string;
  description: string;
  technologies: string[];
  bullets: string[];
}

export function ProjectInlineForm({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (data: ProjectFormData) => void;
  onCancel: () => void;
  initial?: Partial<ProjectFormData>;
}) {
  const editing = Boolean(initial);
  const seeded = splitProjectFields({
    description: initial?.description || '',
    bullets: initial?.bullets || [],
    technologies: initial?.technologies || [],
  });
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(seeded.description);
  const [technologies, setTechnologies] = useState<string[]>(seeded.technologies);
  const [bullets, setBullets] = useState<string[]>(
    seeded.bullets.length ? [...seeded.bullets] : [''],
  );

  return (
    <FormShell
      title={editing ? 'Edit project' : 'Add project'}
      onCancel={onCancel}
      onSave={() =>
        name.trim() &&
        onSave({
          name,
          description,
          technologies,
          bullets: bullets.filter((b) => b.trim()),
        })
      }
      saveLabel={name.trim() ? (editing ? 'Save changes' : 'Add project') : 'Enter project name'}
    >
      <div className="cb-field-grid">
        <div className="cb-field full">
          <label>Project name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Real Estate Website" />
        </div>
        <div className="cb-field full">
          <SkillSearchCombobox
            label="Technologies used"
            selected={technologies}
            onAdd={(s) => setTechnologies((prev) => [...prev, s])}
            onRemove={(s) => setTechnologies((prev) => prev.filter((x) => x !== s))}
            placeholder="Search or type a technology and press Enter"
          />
        </div>
        <div className="cb-field full">
          <label>Short description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief project overview" />
        </div>
        <div className="cb-field full">
          <label>Details (bullet points)</label>
          {bullets.map((bullet, i) => (
            <div key={i} className="cb-bullet-row">
              <input
                value={bullet}
                onChange={(e) => setBullets((prev) => prev.map((b, idx) => (idx === i ? e.target.value : b)))}
                placeholder="Key feature or outcome"
              />
              {bullets.length > 1 && (
                <button
                  type="button"
                  className="cb-bullet-remove"
                  onClick={() => setBullets((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="cb-inline-form-btn cb-inline-form-btn-cancel"
            style={{ marginTop: 4 }}
            onClick={() => setBullets((prev) => [...prev, ''])}
          >
            + Add bullet
          </button>
        </div>
      </div>
    </FormShell>
  );
}

export interface CertificationFormData {
  name: string;
  issuer: string;
  date: string;
}

export function CertificationInlineForm({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (data: CertificationFormData) => void;
  onCancel: () => void;
  initial?: Partial<CertificationFormData>;
}) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name || '');
  const [issuer, setIssuer] = useState(initial?.issuer || '');
  const [date, setDate] = useState(initial?.date || '');

  return (
    <FormShell
      title={editing ? 'Edit certification' : 'Add certification'}
      onCancel={onCancel}
      onSave={() => name.trim() && onSave({ name, issuer, date })}
      saveLabel={name.trim() ? (editing ? 'Save changes' : 'Add certification') : 'Enter name'}
    >
      <div className="cb-field-grid">
        <div className="cb-field full">
          <label>Certification name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Machine Learning Certification" />
        </div>
        <div className="cb-field">
          <label>Issuing organization</label>
          <input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="HackerRank"
          />
        </div>
        <MonthField label="Date (Month + Year)" value={date} onChange={setDate} />
      </div>
    </FormShell>
  );
}

export interface AchievementFormData {
  title: string;
  organization: string;
  description: string;
  date: string;
}

export function AchievementInlineForm({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (data: AchievementFormData) => void;
  onCancel: () => void;
  initial?: Partial<AchievementFormData>;
}) {
  const editing = Boolean(initial);
  const [title, setTitle] = useState(initial?.title || '');
  const [organization, setOrganization] = useState(initial?.organization || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [date, setDate] = useState(initial?.date || '');

  return (
    <FormShell
      title={editing ? 'Edit achievement' : 'Add achievement'}
      onCancel={onCancel}
      onSave={() => title.trim() && onSave({ title, organization, description, date })}
      saveLabel={title.trim() ? (editing ? 'Save changes' : 'Add achievement') : 'Enter title'}
    >
      <div className="cb-field-grid">
        <div className="cb-field full">
          <label>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Black Belt in Karate" />
        </div>
        <div className="cb-field">
          <label>Organization</label>
          <input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Association name" />
        </div>
        <MonthField label="Date" value={date} onChange={setDate} />
        <div className="cb-field full">
          <label>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional details" />
        </div>
      </div>
    </FormShell>
  );
}

export { formatMonthRange, formatEducationYearRange };
