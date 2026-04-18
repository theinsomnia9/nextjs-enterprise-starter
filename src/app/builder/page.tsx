import WorkflowBuilder from '@/components/workflow/WorkflowBuilder'
import ThemeToggle from '@/components/theme/ThemeToggle'

export default function BuilderPage() {
  return (
    <main className="h-screen w-full">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <WorkflowBuilder />
    </main>
  )
}
