'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCandidateMe,
  getProfileCompletion,
  listApplications,
  listInterviews,
  listJobs,
  listResumes,
  logout,
  recommendedJobs,
} from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import type { JobCard } from '@careerbridge/shared';
import { CandidateTopBar } from '@/components/CandidatePortal';
import { ResumeTemplatePicker } from '@/components/ResumeTemplatePicker';
import { IconSidebar } from '@/features/candidate/home/IconSidebar';
import { HomePassportSection } from '@/features/candidate/home/HomePassportSection';
import { HomeDashboardSection } from '@/features/candidate/home/HomeDashboardSection';
import { HomeSkillAssessmentSection } from '@/features/candidate/home/HomeSkillAssessmentSection';
import { HomeInterviewSection } from '@/features/candidate/home/HomeInterviewSection';
import { HomeCoursesHeroSection } from '@/features/candidate/home/HomeCoursesHeroSection';
import { HomeJobsSection } from '@/features/candidate/home/HomeJobsSection';
import { HomeSrsbFooter } from '@/features/candidate/home/HomeSrsbFooter';
import { HomeCareerGrowthAnimation } from '@/features/candidate/home/HomeCareerGrowthAnimation';

function formatPersonName(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

type PassportView = {
  name: string;
  city: string;
  percentage: number;
  skills: string[];
  resumeScore: number | null;
  interviewScore: number | null;
  passportId: string;
  photoUrl: string | null;
  role?: string;
  missing: { label: string; href: string }[];
  applicationsCount: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState('there');
  const [ready, setReady] = useState(false);
  const [passport, setPassport] = useState<PassportView | null>(null);
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateMode, setTemplateMode] = useState<'build' | 'enhance'>('build');

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }
    if (stored.role === 'EMPLOYER_ADMIN' || stored.role === 'EMPLOYER_RECRUITER') {
      router.replace('/employer');
      return;
    }

    const fallbackName = formatPersonName(stored.firstName || 'there');
    setName(fallbackName);
    setReady(true);

    Promise.all([
      getCandidateMe(),
      getProfileCompletion(),
      listResumes().catch(() => []),
      listInterviews().catch(() => []),
      listApplications().catch(() => []),
      recommendedJobs()
        .then((result) => result.items || [])
        .catch(() => listJobs({ limit: 6 }).then((result) => result.items || []).catch(() => [])),
    ])
      .then(([profile, completion, resumes, interviews, applications, jobItems]) => {
        const displayName = formatPersonName(
          [profile.firstName, profile.lastName].filter(Boolean).join(' ') || stored.firstName || 'there',
        );
        setName(displayName);
        const done = interviews.find((item) => item.status === 'COMPLETED' && item.score != null);
        setPassport({
          name: displayName,
          city: profile.city || 'India',
          percentage: completion.percentage,
          skills: profile.skills.map((skill) => skill.name).filter(Boolean),
          resumeScore: resumes[0]?.score ?? null,
          interviewScore: done?.score ?? null,
          passportId: profile.id ? `CB-${profile.id.slice(-4).toUpperCase()}` : 'CB-0000',
          photoUrl: profile.photoUrl,
          role: profile.careerInterests[0] || profile.experiences[0]?.jobTitle || undefined,
          missing: completion.sections
            .filter((item) => !item.done && item.weight > 0)
            .map((item) => ({ label: item.label, href: `${item.href}?flow=1` })),
          applicationsCount: applications.length,
        });
        setJobs(jobItems);
      })
      .catch(() => {
        setPassport(null);
      });
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const scrollToHash = () => {
      const id = window.location.hash.replace(/^#/, '');
      if (!id) return;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, [ready, passport]);

  async function signOut() {
    await logout();
    router.replace('/');
  }

  function openAtsBuilder() {
    setTemplateMode('build');
    setTemplateOpen(true);
  }

  function openAtsEnhance() {
    setTemplateMode('enhance');
    setTemplateOpen(true);
  }

  if (!ready) {
    return null;
  }

  return (
    <div className="cb-home cb-home--sidebar">
      <div className="cb-home-body">
        <IconSidebar passportReady={passport?.percentage ?? 0} />
        <div className="cb-home-content">
          <CandidateTopBar name={name} onSignOut={signOut} />
          <main className="cb-home-main" aria-label="Dashboard">
            <div className="cb-home-top" id="home">
              <header className="cb-home-welcome">
                <h1>
                  <span className="cb-home-welcome__line">Welcome to your dashboard,</span>
                  <span className="cb-home-welcome__row">
                    <span className="cb-home-welcome__name">{name}.</span>
                    <span className="cb-home-welcome__tag">
                      You&apos;re{' '}
                      <em className="cb-home-welcome__mark">a few steps ahead</em>{' '}
                      for your dream{' '}
                      <span className="cb-home-welcome__job">
                        job
                        <span className="cb-job-hang" aria-hidden="true">
                          <span className="cb-job-hang__nail" />
                          <span className="cb-job-hang__swing">
                            <span className="cb-job-hang__string" />
                            <span className="cb-job-hang__case">
                              <svg viewBox="0 0 48 40" fill="none">
                                <path
                                  d="M18 10V8.2A3.2 3.2 0 0 1 21.2 5h5.6A3.2 3.2 0 0 1 30 8.2V10"
                                  stroke="#062120"
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                />
                                <rect x="6" y="10" width="36" height="24" rx="4" fill="#0a2e2c" />
                                <rect x="6" y="18" width="36" height="6" fill="#062120" />
                                <rect x="21" y="19.5" width="6" height="7" rx="1.2" fill="#eab308" />
                              </svg>
                            </span>
                          </span>
                        </span>
                      </span>
                      .
                    </span>
                    <HomeCareerGrowthAnimation />
                  </span>
                </h1>
              </header>
            </div>

            <div className="cb-home-stage" id="passport">
              {passport ? (
                <HomePassportSection
                  name={passport.name}
                  city={passport.city}
                  percentage={passport.percentage}
                  skills={passport.skills}
                  resumeScore={passport.resumeScore}
                  interviewScore={passport.interviewScore}
                  passportId={passport.passportId}
                  photoUrl={passport.photoUrl}
                  role={passport.role}
                  missing={passport.missing}
                />
              ) : null}
            </div>

            <div id="resume">
              <HomeDashboardSection onBuildResume={openAtsBuilder} onEnhanceResume={openAtsEnhance} />
            </div>
            <div id="skill">
              <HomeSkillAssessmentSection />
            </div>
            <div id="interview">
              <HomeInterviewSection />
            </div>
            <div id="courses">
              <HomeCoursesHeroSection />
            </div>
            <div id="jobs">
              <HomeJobsSection jobs={jobs} city={passport?.city} />
            </div>
          </main>
          <HomeSrsbFooter />
        </div>
      </div>

      <ResumeTemplatePicker
        open={templateOpen}
        mode={templateMode}
        onClose={() => setTemplateOpen(false)}
      />
    </div>
  );
}
