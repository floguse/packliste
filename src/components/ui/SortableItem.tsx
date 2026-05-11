import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { ReactNode } from 'react'

interface Props {
  id: string
  children: (handle: ReactNode) => ReactNode
}

export default function SortableItem({ id, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 10 : undefined,
  }

  const handle = (
    <button
      {...attributes}
      {...listeners}
      className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
      tabIndex={-1}
    >
      <GripVertical size={16} />
    </button>
  )

  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  )
}
