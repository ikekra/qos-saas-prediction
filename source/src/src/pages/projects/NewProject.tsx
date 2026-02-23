import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ProjectForm } from '@/components/ProjectForm';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NewProject() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (data: {
    title: string;
    description: string;
    status: string;
    tags: string[];
  }) => {
    if (!user) return;

    const { error } = await supabase.from('projects').insert({
      title: data.title,
      description: data.description,
      status: data.status,
      tags: data.tags,
      owner: user.id,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create project',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Project created successfully',
      });
      navigate('/projects');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/projects')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>

        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold tracking-tight">Create New Project</h1>
          <p className="text-muted-foreground mt-2">
            Fill in the details to create a new project
          </p>
        </div>

        <div className="animate-slide-up">
          <ProjectForm
            onSubmit={handleSubmit}
            onCancel={() => navigate('/projects')}
            submitLabel="Create Project"
          />
        </div>
      </main>
    </div>
  );
}