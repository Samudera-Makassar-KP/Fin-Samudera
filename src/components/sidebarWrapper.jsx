import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { routesConfig } from './routesConfig';

const SidebarWrapper = ({ role }) => {
    const location = useLocation();

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };
    
    const showSidebar = location.pathname !== '/' && routesConfig.includes(location.pathname);

    return showSidebar ? (
        <Sidebar
            role={role}
            isOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}            
        />
    ) : null;
};

export default SidebarWrapper;