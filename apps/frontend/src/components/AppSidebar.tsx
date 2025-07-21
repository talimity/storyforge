import { useState } from "react";
import { 
  Users, 
  BookOpen, 
  Scroll, 
  Bot, 
  Key, 
  Play,
  Home,
  Settings
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const libraryItems = [
  { title: "Characters", url: "/characters", icon: Users },
  { title: "Scenarios", url: "/scenarios", icon: BookOpen },
  { title: "Lorebooks", url: "/lorebooks", icon: Scroll },
  { title: "Agent Configs", url: "/agents", icon: Bot },
  { title: "API Configs", url: "/api", icon: Key },
];

const mainItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Active Scenarios", url: "/active", icon: Play },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isGroupActive = (items: typeof libraryItems) => 
    items.some(item => isActive(item.url));

  const getNavClasses = (path: string) =>
    isActive(path) 
      ? "bg-primary/20 text-primary border-r-2 border-primary font-medium" 
      : "text-muted-foreground hover:text-foreground hover:bg-accent/10";

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarContent className="py-4">
        {/* Brand */}
        <div className="px-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            {state !== "collapsed" && (
              <div>
                <h2 className="font-display font-semibold text-sidebar-foreground">ANE</h2>
                <p className="text-xs text-sidebar-foreground/60">v0.1.0</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClasses(item.url)}>
                      <item.icon className="w-4 h-4" />
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Library Navigation */}
        <SidebarGroup>
          {state !== "collapsed" && (
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
              Library
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {libraryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClasses(item.url)}>
                      <item.icon className="w-4 h-4" />
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <div className="mt-auto">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/settings" className={getNavClasses("/settings")}>
                      <Settings className="w-4 h-4" />
                      {state !== "collapsed" && <span>Settings</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}