"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export interface NavigationItem {
  id: string;
  label: string;
}

export interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

interface LegalSidebarProps {
  title: string;
  navigation: NavigationSection[];
}

export function LegalSidebar({ title, navigation }: LegalSidebarProps) {
  const [activeSection, setActiveSection] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-200px 0px -50% 0px" }
    );

    document.querySelectorAll("section[id]").forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const handleNavClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setMobileOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-[1001] bg-white p-3 rounded-lg shadow-lg border border-[#e1e5e9]"
        aria-label="Toggle menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-[#065183]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {mobileOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      <aside
        className={`
          fixed left-0 top-0 h-screen w-[280px] bg-white border-r border-[#e1e5e9]
          overflow-y-auto z-[1000] shadow-lg transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        <div className="p-5 border-b border-[#e1e5e9] bg-[#f8f9fa]">
          <Image
            src="/logo.png"
            alt="Infocell Logo"
            width={150}
            height={50}
            className="mb-2"
            priority
          />
          <h2 className="text-[#2c3e50] text-lg font-semibold mt-3">{title}</h2>
        </div>

        <nav className="py-2">
          {navigation.map((section) => (
            <div key={section.title} className="mb-2">
              <div className="px-5 py-2 text-xs font-semibold text-[#6c757d] uppercase tracking-wider">
                {section.title}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`
                    block w-full text-left py-2 px-5 text-sm border-l-[3px] transition-all
                    ${
                      activeSection === item.id
                        ? "bg-[#e8f4f8] text-[#065183] border-l-[#0000FF] font-medium"
                        : "text-[#495057] border-l-transparent hover:bg-gray-50 hover:text-[#2c3e50] hover:border-l-[#065183]"
                    }
                  `}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[999]"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
