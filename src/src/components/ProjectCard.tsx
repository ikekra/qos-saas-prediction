import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

const statusColors: Record<string, string> = {
  'planning': 'bg-blue-500/10 text-blue-700 border-blue-200',
  'in-progress': 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  'completed': 'bg-green-500/10 text-green-700 border-green-200',
  'on-hold': 'bg-gray-500/10 text-gray-700 border-gray-200',
};

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  return (
    <Card className="gradient-card shadow-soft hover:shadow-medium transition-all duration-300 animate-fade-in">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{project.title}</CardTitle>
            <CardDescription className="line-clamp-2">
              {project.description || 'No description provided'}
            </CardDescription>
          </div>
          <Badge className={statusColors[project.status] || ''} variant="outline">
            {project.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        
        <div className="flex items-center text-sm text-muted-foreground">
          <Clock className="mr-2 h-4 w-4" />
          Updated {format(new Date(project.updated_at), 'MMM d, yyyy')}
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2">
        <Link to={`/projects/edit/${project.id}`} className="flex-1">
          <Button variant="outline" className="w-full">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
        <Button
          variant="destructive"
          onClick={() => onDelete(project.id)}
          className="flex-1"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}