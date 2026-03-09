import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Users, Code2, Video, ClipboardCheck, Loader2, UserCheck } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['interviewer', 'candidate']).optional(),
});

type UserRole = 'interviewer' | 'candidate';

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('candidate');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const validateForm = (isSignUp: boolean) => {
    try {
      if (isSignUp) {
        authSchema.parse(formData);
      } else {
        authSchema.omit({ fullName: true }).parse(formData);
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    
    setIsSubmitting(true);
    const { error } = await signIn(formData.email, formData.password);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message === 'Invalid login credentials' 
          ? 'Email or password is incorrect. Please try again.'
          : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Welcome back!',
        description: 'Successfully signed in.',
      });
      navigate('/dashboard');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    
    setIsSubmitting(true);
    const { error } = await signUp(formData.email, formData.password, formData.fullName, selectedRole);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'Sign up failed',
        description: error.message.includes('already registered')
          ? 'This email is already registered. Please sign in instead.'
          : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Account created!',
        description: `Welcome to InterviewHub as ${selectedRole === 'interviewer' ? 'an Interviewer' : 'a Candidate'}.`,
      });
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg btn-gradient flex items-center justify-center">
              <Code2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-sidebar-foreground">InterviewHub</span>
          </div>
          
          <h1 className="text-4xl font-bold text-sidebar-foreground mb-6 leading-tight">
            Technical interviews,<br />
            <span className="gradient-text">reimagined.</span>
          </h1>
          
          <p className="text-sidebar-foreground/70 text-lg mb-12 max-w-md">
            A modern platform designed to make technical interviews comfortable, 
            collaborative, and insightful for everyone involved.
          </p>

          <div className="space-y-6">
            {[
              { icon: Video, title: 'HD Video Calls', desc: 'Crystal clear video with screen sharing' },
              { icon: Code2, title: 'Live Code Editor', desc: 'Real-time collaborative coding environment' },
              { icon: ClipboardCheck, title: 'Smart Evaluation', desc: 'Rubric-based scoring with timestamped notes' },
              { icon: Users, title: 'Role Management', desc: 'Streamlined workflows for all participants' },
            ].map((feature, i) => (
              <div 
                key={i} 
                className="flex items-start gap-4 animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-10 h-10 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0">
                  <feature.icon className="h-5 w-5 text-sidebar-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sidebar-foreground">{feature.title}</h3>
                  <p className="text-sm text-sidebar-foreground/60">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sidebar-foreground/50 text-sm">
          © 2024 InterviewHub. Built with care for a better interview experience.
        </p>
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-lg btn-gradient flex items-center justify-center">
              <Code2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold">InterviewHub</span>
          </div>

          <Card className="glass-card">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="input-field"
                        required
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="input-field"
                        required
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      variant="gradient"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    {/* Role Selection */}
                    <div className="space-y-2">
                      <Label>I am signing up as</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRole('interviewer')}
                          className={cn(
                            "p-4 rounded-xl border-2 transition-all duration-200 text-left",
                            selectedRole === 'interviewer'
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50 hover:bg-accent/50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              selectedRole === 'interviewer' ? "bg-primary/20" : "bg-muted"
                            )}>
                              <UserCheck className={cn(
                                "w-5 h-5",
                                selectedRole === 'interviewer' ? "text-primary" : "text-muted-foreground"
                              )} />
                            </div>
                            <div>
                              <p className={cn(
                                "font-semibold text-sm",
                                selectedRole === 'interviewer' ? "text-primary" : "text-foreground"
                              )}>Interviewer</p>
                              <p className="text-xs text-muted-foreground">Conduct interviews</p>
                            </div>
                          </div>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setSelectedRole('candidate')}
                          className={cn(
                            "p-4 rounded-xl border-2 transition-all duration-200 text-left",
                            selectedRole === 'candidate'
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-accent/50 hover:bg-accent/50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              selectedRole === 'candidate' ? "bg-accent/20" : "bg-muted"
                            )}>
                              <Users className={cn(
                                "w-5 h-5",
                                selectedRole === 'candidate' ? "text-accent" : "text-muted-foreground"
                              )} />
                            </div>
                            <div>
                              <p className={cn(
                                "font-semibold text-sm",
                                selectedRole === 'candidate' ? "text-accent" : "text-foreground"
                              )}>Candidate</p>
                              <p className="text-xs text-muted-foreground">Join interviews</p>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="input-field"
                        required
                      />
                      {errors.fullName && (
                        <p className="text-sm text-destructive">{errors.fullName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="input-field"
                        required
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="input-field"
                        required
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      variant="gradient"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
