import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        variables: {
          colorPrimary: "hsl(142, 76%, 36%)",
          colorTextOnPrimaryBackground: "hsl(0, 0%, 100%)",
          borderRadius: "0.5rem",
        },
        elements: {
          card: "shadow-md border border-border",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton:
            "border-border text-foreground hover:bg-muted",
          formFieldLabel: "text-foreground",
          formFieldInput:
            "border-input bg-background text-foreground focus:ring-primary",
          footerActionLink: "text-primary hover:text-primary/80",
          identityPreviewEditButton: "text-primary hover:text-primary/80",
        },
      }}
    />
  );
}
