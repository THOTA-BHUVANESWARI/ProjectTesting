import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Code2, 
  Video, 
  ClipboardCheck, 
  Users, 
  ArrowRight,
  Shield,
  Zap,
  Globe,
} from 'lucide-react';

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: Video,
      title: 'HD Video Calls',
      description: 'Crystal clear video interviews with screen sharing and recording capabilities.',
    },
    {
      icon: Code2,
      title: 'Live Code Editor',
      description: 'Real-time collaborative coding with syntax highlighting for multiple languages.',
    },
    {
      icon: ClipboardCheck,
      title: 'Smart Evaluation',
      description: 'Rubric-based scoring with timestamped feedback for objective assessments.',
    },
    {
      icon: Users,
      title: 'Role Management',
      description: 'Streamlined workflows for admins, interviewers, and candidates.',
    },
  ];

  const benefits = [
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Enterprise-grade security with encrypted communications.',
    },
    {
      icon: Zap,
      title: 'Fast & Reliable',
      description: 'Low-latency streaming and real-time synchronization.',
    },
    {
      icon: Globe,
      title: 'Works Everywhere',
      description: 'Browser-based platform - no downloads required.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        
        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg btn-gradient flex items-center justify-center">
              <Code2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold">InterviewHub</span>
          </div>
          <Button variant="gradient" onClick={() => navigate('/auth')}>
            Get Started
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 px-6 py-24 max-w-7xl mx-auto text-center">
          <div className="animate-fade-in">
            <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              The Future of Technical Interviews
            </span>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Technical interviews,
              <br />
              <span className="gradient-text">reimagined.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              A modern platform designed to make technical interviews comfortable, 
              collaborative, and insightful for everyone involved.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="xl" 
                variant="gradient"
                onClick={() => navigate('/auth')}
                className="text-lg"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button 
                size="xl" 
                variant="outline"
                onClick={() => navigate('/lobby')}
                className="text-lg"
              >
                Quick Interview
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-slide-up">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need for better interviews
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From video calls to code collaboration, we've built the tools that 
              help you focus on what matters - finding great talent.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="interview-card p-8 animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-xl btn-gradient flex items-center justify-center mb-6">
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-6 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, i) => (
              <div
                key={benefit.title}
                className="text-center animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <benefit.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center animate-slide-up">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to transform your interview process?
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join thousands of companies that use InterviewHub to find and hire 
            the best technical talent.
          </p>
          <Button 
            size="xl" 
            variant="gradient"
            onClick={() => navigate('/auth')}
            className="text-lg"
          >
            Get Started for Free
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg btn-gradient flex items-center justify-center">
              <Code2 className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold">InterviewHub</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 InterviewHub. Built with care for a better interview experience.
          </p>
        </div>
      </footer>
    </div>
  );
}
