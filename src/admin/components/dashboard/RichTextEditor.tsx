import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { richTextToPlainText, sanitizeRichTextHtml } from '../../../shared/richText'
import './richTextEditor.css'

type Props = {
  value: string
  maxLength: number
  invalid?: boolean
  onChange: (value: string) => void
}

const stateCommands = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull']

type EditorIconName =
  | 'format_list_bulleted'
  | 'format_list_numbered'
  | 'format_align_left'
  | 'format_align_center'
  | 'format_align_right'
  | 'format_align_justify'
  | 'format_indent_decrease'
  | 'format_indent_increase'
  | 'format_line_spacing'
  | 'format_color_text'
  | 'link'
  | 'link_off'
  | 'undo'
  | 'redo'
  | 'format_clear'

function EditorIcon({ name }: { name: EditorIconName }) {
  const paths: Record<EditorIconName, ReactNode> = {
    format_list_bulleted: <><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" /><path d="M9 7h10M9 12h10M9 17h10" /></>,
    format_list_numbered: <><text x="3.2" y="8.5">1</text><text x="3" y="14">2</text><text x="3" y="19.5">3</text><path d="M9 7h10M9 12h10M9 17h10" /></>,
    format_align_left: <path d="M4 6h16M4 10h10M4 14h16M4 18h12" />,
    format_align_center: <path d="M4 6h16M7 10h10M4 14h16M6 18h12" />,
    format_align_right: <path d="M4 6h16M10 10h10M4 14h16M8 18h12" />,
    format_align_justify: <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />,
    format_indent_decrease: <><path d="M10 6h10M10 10h8M10 14h10M10 18h8M7 9l-3 3 3 3" /></>,
    format_indent_increase: <><path d="M10 6h10M10 10h8M10 14h10M10 18h8M4 9l3 3-3 3" /></>,
    format_line_spacing: <><path d="M8 6h12M8 12h12M8 18h12M4 5v14M2.5 7 4 5l1.5 2M2.5 17 4 19l1.5-2" /></>,
    format_color_text: <><path d="m7 17 5-11 5 11M9 13h6M5 20h14" /></>,
    link: <><path d="M9.5 14.5 14.5 9.5M8.2 16.8l-1 .9a3.2 3.2 0 0 1-4.5-4.5l3-3a3.2 3.2 0 0 1 4.5 0M15.8 7.2l1-.9a3.2 3.2 0 0 1 4.5 4.5l-3 3a3.2 3.2 0 0 1-4.5 0" /></>,
    link_off: <><path d="m4 4 16 16M8.2 16.8l-1 .9a3.2 3.2 0 0 1-4.5-4.5l3-3M15.8 7.2l1-.9a3.2 3.2 0 0 1 4.5 4.5l-3 3M10.5 13.5l3-3" /></>,
    undo: <><path d="M9 8 5 12l4 4M6 12h7a6 6 0 0 1 6 6" /></>,
    redo: <><path d="m15 8 4 4-4 4M18 12h-7a6 6 0 0 0-6 6" /></>,
    format_clear: <><path d="M6 6h12M10 6l-3 12M14 6l-1.2 5M4 20 20 4" /></>,
  }

  return (
    <svg className="activity-rich-editor__icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function RichTextEditor({ value, maxLength, invalid = false, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const acceptedValue = useRef(sanitizeRichTextHtml(value))
  const [active, setActive] = useState<Set<string>>(new Set())
  const [textColor, setTextColor] = useState('#3d4857')
  const [blockType, setBlockType] = useState('p')

  useLayoutEffect(() => {
    const editor = editorRef.current
    const nextValue = sanitizeRichTextHtml(value)
    acceptedValue.current = nextValue
    if (!editor || document.activeElement === editor) return
    if (sanitizeRichTextHtml(editor.innerHTML) !== nextValue) editor.innerHTML = nextValue
  }, [value])

  const rememberSelection = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange()
    }

    const currentBlock = String(document.queryCommandValue('formatBlock')).toLowerCase().replace(/[<>]/g, '')
    if (['p', 'h2', 'h3', 'blockquote'].includes(currentBlock)) setBlockType((current) => current === currentBlock ? current : currentBlock)

    const nextActive = new Set(stateCommands.filter((command) => document.queryCommandState(command)))
    setActive((current) => (
      current.size === nextActive.size && [...current].every((command) => nextActive.has(command))
        ? current
        : nextActive
    ))
  }

  const restoreSelection = () => {
    editorRef.current?.focus({ preventScroll: true })
    if (!savedRange.current) return
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(savedRange.current)
  }

  const moveCaretToEnd = (editor: HTMLDivElement) => {
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const emit = () => {
    const editor = editorRef.current
    if (!editor) return

    const cleaned = sanitizeRichTextHtml(editor.innerHTML)
    const nextValue = cleaned === '<br>' || cleaned === '<div><br></div>' || cleaned === '<p><br></p>' ? '' : cleaned
    if ((editor.innerText ?? '').replace(/\r\n/g, '\n').length > maxLength) {
      editor.innerHTML = acceptedValue.current
      moveCaretToEnd(editor)
      return
    }

    acceptedValue.current = nextValue
    onChange(nextValue)
  }

  const command = (name: string, commandValue?: string) => {
    restoreSelection()
    if (['bold', 'italic', 'underline'].includes(name)) document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(name, false, commandValue)
    emit()
    rememberSelection()
  }

  const applyTextColor = (color: string) => {
    setTextColor(color)
    restoreSelection()
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('foreColor', false, color)
    document.execCommand('styleWithCSS', false, 'false')
    emit()
    rememberSelection()
  }

  const applyLineHeight = (lineHeight: string) => {
    restoreSelection()
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount) return

    let range = selection.getRangeAt(0)
    let blocks = Array.from(editor.querySelectorAll<HTMLElement>('p, div, h2, h3, li, blockquote'))
      .filter((element) => range.intersectsNode(element))

    if (!blocks.length) {
      document.execCommand('formatBlock', false, 'p')
      const currentSelection = window.getSelection()
      if (!currentSelection?.rangeCount) return
      range = currentSelection.getRangeAt(0)
      blocks = Array.from(editor.querySelectorAll<HTMLElement>('p, div, h2, h3, li, blockquote'))
        .filter((element) => range.intersectsNode(element))
    }

    blocks.forEach((element) => { element.style.lineHeight = lineHeight })
    emit()
    rememberSelection()
  }

  const addLink = () => {
    restoreSelection()
    const raw = window.prompt('วาง URL ที่ต้องการเชื่อมโยง')?.trim()
    if (!raw) return
    const href = /^(https?:|mailto:|tel:)/i.test(raw) ? raw : `https://${raw}`

    try {
      const parsed = new URL(href)
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) throw new Error()
    } catch {
      window.alert('ลิงก์ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
      return
    }

    const selection = window.getSelection()
    if (selection?.isCollapsed) {
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.textContent = href
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      document.execCommand('insertHTML', false, anchor.outerHTML)
    } else {
      document.execCommand('createLink', false, href)
    }

    editorRef.current?.querySelectorAll('a').forEach((anchor) => {
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
    })
    emit()
    rememberSelection()
  }

  const toolbarButton = (label: string, name: string, content: ReactNode, title = label) => (
    <button
      type="button"
      className={active.has(name) ? 'is-active' : ''}
      aria-label={label}
      aria-pressed={active.has(name)}
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => command(name)}
    >
      {content}
    </button>
  )

  const icon = (name: EditorIconName) => <EditorIcon name={name} />

  return (
    <div className={`activity-rich-editor${invalid ? ' is-invalid' : ''}`}>
      <div className="activity-rich-editor__toolbar" role="toolbar" aria-label="เครื่องมือจัดรูปแบบรายละเอียด">
        <select
          className="activity-rich-editor__paragraph"
          aria-label="รูปแบบข้อความ"
          value={blockType}
          onMouseDown={rememberSelection}
          onChange={(event) => {
            setBlockType(event.target.value)
            command('formatBlock', event.target.value)
          }}
        >
          <option value="p">ข้อความปกติ</option>
          <option value="h2">หัวข้อใหญ่</option>
          <option value="h3">หัวข้อย่อย</option>
          <option value="blockquote">ข้อความเน้น</option>
        </select>

        <span className="activity-rich-editor__group">
          {toolbarButton('ตัวหนา', 'bold', <b>B</b>)}
          {toolbarButton('ตัวเอียง', 'italic', <i>I</i>)}
          {toolbarButton('ขีดเส้นใต้', 'underline', <u>U</u>)}
        </span>

        <span className="activity-rich-editor__group">
          {toolbarButton('รายการหัวข้อ', 'insertUnorderedList', icon('format_list_bulleted'))}
          {toolbarButton('รายการลำดับเลข', 'insertOrderedList', icon('format_list_numbered'))}
        </span>

        <span className="activity-rich-editor__group">
          {toolbarButton('จัดชิดซ้าย', 'justifyLeft', icon('format_align_left'))}
          {toolbarButton('จัดกึ่งกลาง', 'justifyCenter', icon('format_align_center'))}
          {toolbarButton('จัดชิดขวา', 'justifyRight', icon('format_align_right'))}
          {toolbarButton('จัดเต็มบรรทัด', 'justifyFull', icon('format_align_justify'))}
        </span>

        <span className="activity-rich-editor__group">
          {toolbarButton('ลดการเยื้อง', 'outdent', icon('format_indent_decrease'))}
          {toolbarButton('เพิ่มการเยื้อง', 'indent', icon('format_indent_increase'))}
          <label className="activity-rich-editor__picker" title="ระยะห่างบรรทัด">
            {icon('format_line_spacing')}
            <select
              aria-label="ระยะห่างบรรทัด"
              defaultValue="1.7"
              onMouseDown={rememberSelection}
              onChange={(event) => applyLineHeight(event.target.value)}
            >
              <option value="1">1.0</option>
              <option value="1.4">1.4</option>
              <option value="1.7">1.7</option>
              <option value="2">2.0</option>
            </select>
          </label>
          <label className="activity-rich-editor__picker activity-rich-editor__color" title="สีตัวอักษร">
            {icon('format_color_text')}
            <i style={{ backgroundColor: textColor }} aria-hidden="true" />
            <input
              type="color"
              value={textColor}
              aria-label="เลือกสีตัวอักษร"
              onMouseDown={rememberSelection}
              onChange={(event) => applyTextColor(event.target.value)}
            />
          </label>
        </span>

        <span className="activity-rich-editor__group">
          <button type="button" aria-label="เพิ่มลิงก์" title="เพิ่มลิงก์ (Ctrl+K)" onMouseDown={(event) => event.preventDefault()} onClick={addLink}>{icon('link')}</button>
          <button type="button" aria-label="ลบลิงก์" title="ลบลิงก์" onMouseDown={(event) => event.preventDefault()} onClick={() => command('unlink')}>{icon('link_off')}</button>
        </span>

        <span className="activity-rich-editor__group activity-rich-editor__group--history">
          <button type="button" aria-label="ย้อนกลับ" title="ย้อนกลับ" onMouseDown={(event) => event.preventDefault()} onClick={() => command('undo')}>{icon('undo')}</button>
          <button type="button" aria-label="ทำซ้ำ" title="ทำซ้ำ" onMouseDown={(event) => event.preventDefault()} onClick={() => command('redo')}>{icon('redo')}</button>
          <button type="button" aria-label="ล้างรูปแบบ" title="ล้างรูปแบบ" onMouseDown={(event) => event.preventDefault()} onClick={() => command('removeFormat')}>{icon('format_clear')}</button>
        </span>
      </div>

      <div
        ref={editorRef}
        className="activity-rich-editor__content"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="รายละเอียดกิจกรรม"
        aria-multiline="true"
        aria-invalid={invalid || undefined}
        data-placeholder="เขียนรายละเอียดกิจกรรม..."
        onInput={emit}
        onMouseUp={rememberSelection}
        onFocus={rememberSelection}
        onPaste={(event) => {
          event.preventDefault()
          document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
          window.requestAnimationFrame(emit)
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault()
            addLink()
            return
          }
          if (event.ctrlKey || event.metaKey || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            window.requestAnimationFrame(rememberSelection)
          }
        }}
      />

      <div className="activity-rich-editor__footer">
        <span>เลือกข้อความแล้วกดเครื่องมือเพื่อจัดรูปแบบ</span>
        <strong>{richTextToPlainText(value).length.toLocaleString('th-TH')} / {maxLength.toLocaleString('th-TH')}</strong>
      </div>
    </div>
  )
}

export default RichTextEditor
