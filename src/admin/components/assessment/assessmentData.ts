import type { IconName } from '../../../shared/components/ui/Icon'

export type AssessmentSkill = {
  title: string
  description: string
  icon: IconName
  tone: string
}

export const assessmentSkills: AssessmentSkill[] = [
  {
    title: 'Leadership & Integrity',
    description: 'Influence and visionary guidance.',
    icon: 'check',
    tone: 'orange',
  },
  {
    title: 'Integrity',
    description: 'Ethical decision making.',
    icon: 'draft',
    tone: 'orange',
  },
  {
    title: 'Problem Solving',
    description: 'Critical thinking skills.',
    icon: 'analytics',
    tone: 'orange',
  },
  {
    title: 'Teamwork',
    description: 'Collaborative performance.',
    icon: 'participants',
    tone: 'orange',
  },
  {
    title: 'Communication',
    description: 'Verbal and written clarity.',
    icon: 'book',
    tone: 'orange',
  },
  {
    title: 'Creativity',
    description: 'Innovative thinking.',
    icon: 'draft',
    tone: 'orange',
  },
  {
    title: 'Adaptability',
    description: 'Flexibility in change.',
    icon: 'activities',
    tone: 'orange',
  },
  {
    title: 'Responsibility',
    description: 'Accountability and ownership.',
    icon: 'check',
    tone: 'orange',
  },
  {
    title: 'Lifelong Learning',
    description: 'Continuous self-improvement.',
    icon: 'rocket',
    tone: 'orange',
  },
]
