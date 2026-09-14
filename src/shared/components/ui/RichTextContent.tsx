import { sanitizeRichTextHtml } from '../../richText'
import './richTextContent.css'

type Props = { value: string | null | undefined; className?: string }

function RichTextContent({ value, className = '' }: Props) {
  return <div className={`rich-text-content ${className}`.trim()} dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(value ?? '') }} />
}

export default RichTextContent
