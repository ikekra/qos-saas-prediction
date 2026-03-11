import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ProjectForm } from '@/components/ProjectForm';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Project {
  title: string;
  description: string;
  status: string;
  tags: string[];
}

export default function EditProject() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProject();
  }, [id, user]);

  const fetchProject = async () => {
    if (!id || !user) return;

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('owner', user.id)
      .single();

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch project',
      });
      navigate('/projects');
    } else {
      setProject(data);
    }

    setLoading(false);
  };

  const handleSubmit = async (data: {
    title: string;
    description: string;
    status: string;
    tags: string[];
  }) => {
    if (!id || !user) return;

    const { error } = await supabase
      .from('projects')
      .update({
        title: data.title,
        description: data.description,
        status: data.status,
        tags: data.tags,
      })
      .eq('id', id)
      .eq('owner', user.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update project',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Project updated successfully',
      });
      navigate('/projects');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center py-12">
          <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

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
          <h1 className="text-4xl font-bold tracking-tight">Edit Project</h1>
          <p className="text-muted-foreground mt-2">
            Update your project details
          </p>
        </div>

        <div className="animate-slide-up">
          <ProjectForm
            initialData={project}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/projects')}
            submitLabel="Update Project"
          />
        </div>
      </main>
    </div>
  );
}