export const ContainerPage = ({ children }: React.PropsWithChildren) => (
  <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:gap-5 sm:p-6 lg:gap-6 lg:p-10 overflow-x-hidden">
    {children}
  </main>
);
