'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SUGGESTED_SKILLS, salaryRangeError } from '@careerbridge/shared';
import { createEmployerJob, publishEmployerJob } from '@/lib/api';
import { EmployerHeader, EmployerNav } from '@/components/EmployerNav';
import { Input } from '@/components/ui/Input';
import { CitySelect } from '@/components/ui/CitySelect';
import { CategorySelect } from '@/components/ui/CategorySelect';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

export default function NewJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('Chennai');
  const [category, setCategory] = useState('Customer Service');
  const [salaryMin, setSalaryMin] = useState('18000');
  const [salaryMax, setSalaryMax] = useState('24000');
  const [skills, setSkills] = useState<string[]>(['Communication']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggle(skill: string) {
    setSkills((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (title.trim().length < 2) {
      setError('Enter a job title.');
      return;
    }
    if (description.trim().length < 20) {
      setError('Add a short job description of at least 20 characters.');
      return;
    }
    if (city.trim().length < 2) {
      setError('Select or enter the job location.');
      return;
    }
    if (category.trim().length < 2) {
      setError('Select or enter a job category.');
      return;
    }
    const salaryError = salaryRangeError(salaryMin, salaryMax);
    if (salaryError) {
      setError(salaryError);
      return;
    }
    if (!skills.length) {
      setError('Select at least one required skill.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const job = await createEmployerJob({
        title,
        description,
        city,
        category,
        salaryMin: Number(salaryMin),
        salaryMax: Number(salaryMax),
        requiredSkills: skills,
        jobType: 'FULL_TIME',
        experience: 'NONE',
      }) as { id: string };
      await publishEmployerJob(job.id);
      router.replace('/employer/jobs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not create this job.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <EmployerHeader />
      <h1 className="mt-4 text-2xl font-bold text-primary">Create job</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-md bg-surface p-5 shadow-sm">
        <Input label="Job title" name="title" required value={title} onChange={(event) => setTitle(event.target.value)} />
        <Textarea label="Job description" name="description" required value={description} onChange={(event) => setDescription(event.target.value)} />
        <CitySelect label="Location" required value={city} onChange={setCity} />
        <CategorySelect required value={category} onChange={setCategory} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Salary from" name="salaryMin" value={salaryMin} onChange={(event) => setSalaryMin(event.target.value)} />
          <Input label="Salary to" name="salaryMax" value={salaryMax} onChange={(event) => setSalaryMax(event.target.value)} />
        </div>
        <p className="text-sm font-medium">Required skills</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_SKILLS.map((item) => (
            <button key={item} type="button" onClick={() => toggle(item)} className={`rounded-pill border px-3 py-2 text-sm ${skills.includes(item) ? 'border-primary bg-primary text-accent' : 'border-primary/20'}`}>
              {item}
            </button>
          ))}
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <Button type="submit" loading={loading} loadingLabel="Publishing...">Publish job</Button>
      </form>
      <EmployerNav />
    </main>
  );
}
