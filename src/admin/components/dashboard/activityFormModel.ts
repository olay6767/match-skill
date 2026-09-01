import type { CreateActivityInput } from './types'
import { DEFAULT_FORM_THEME } from '../../../shared/formTheme'

export type ActivityFormValues = CreateActivityInput

export const emptyActivityForm: ActivityFormValues = {
  name: '', detail: '', imageData: null, assessmentImageData: null, formTheme: { ...DEFAULT_FORM_THEME }, location: null, startDate: null,
  surveyTemplateId: null, targetGroup: null, participantLimit: 0,
  preTestDurationMinutes: 15, postTestDurationMinutes: 15,
}
