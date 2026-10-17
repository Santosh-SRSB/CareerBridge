export type CourseCard = {
  id: string;
  title: string;
  provider: string;
  level: string;
  duration: string;
  blurb: string;
  image: string;
  priceLabel: string;
  tag: string;
};

/** Dummy course catalogue for Course Pool + dashboard suggestions. */
export const COURSE_CATALOG: CourseCard[] = [
  {
    id: 'c1',
    title: 'Full-Stack Web Foundations',
    provider: 'CareerBridge Labs',
    level: 'Beginner',
    duration: '6 weeks',
    blurb: 'HTML, CSS, JavaScript, and a first React project.',
    image: '/resume/plain-1.png',
    priceLabel: 'Free trial',
    tag: 'Tech',
  },
  {
    id: 'c2',
    title: 'Data Analysis with Excel & SQL',
    provider: 'Insight Studio',
    level: 'Beginner',
    duration: '4 weeks',
    blurb: 'Clean data, write queries, and present simple dashboards.',
    image: '/resume/plain-2.png',
    priceLabel: '₹499',
    tag: 'Analytics',
  },
  {
    id: 'c3',
    title: 'Communication for Interviews',
    provider: 'SpeakWell',
    level: 'All levels',
    duration: '3 weeks',
    blurb: 'Storytelling, body language, and STAR answers.',
    image: '/resume/plain-3.png',
    priceLabel: 'Free',
    tag: 'Soft skills',
  },
  {
    id: 'c4',
    title: 'Python for Automation',
    provider: 'CodeCraft',
    level: 'Intermediate',
    duration: '5 weeks',
    blurb: 'Scripts, APIs, and everyday automation tasks.',
    image: '/resume/plain-4.png',
    priceLabel: '₹799',
    tag: 'Tech',
  },
  {
    id: 'c5',
    title: 'UI Design Crash Course',
    provider: 'Pixel Path',
    level: 'Beginner',
    duration: '4 weeks',
    blurb: 'Layouts, typography, and Figma basics for product roles.',
    image: '/resume/plain-5.png',
    priceLabel: '₹599',
    tag: 'Design',
  },
  {
    id: 'c6',
    title: 'Cloud Basics on AWS',
    provider: 'Nimbus Track',
    level: 'Beginner',
    duration: '5 weeks',
    blurb: 'Core services, IAM, and deploying a simple app.',
    image: '/resume/photo-1.png',
    priceLabel: '₹999',
    tag: 'Cloud',
  },
  {
    id: 'c7',
    title: 'Digital Marketing Essentials',
    provider: 'Growth Desk',
    level: 'Beginner',
    duration: '4 weeks',
    blurb: 'SEO, ads, and measuring what works.',
    image: '/resume/photo-2.png',
    priceLabel: '₹449',
    tag: 'Marketing',
  },
  {
    id: 'c8',
    title: 'Excel Power User',
    provider: 'Numbers Lab',
    level: 'Intermediate',
    duration: '3 weeks',
    blurb: 'Pivot tables, lookups, and clean reporting.',
    image: '/resume/photo-3.png',
    priceLabel: 'Free',
    tag: 'Office',
  },
];

export function suggestedCourses(limit = 3): CourseCard[] {
  return COURSE_CATALOG.slice(0, limit);
}
