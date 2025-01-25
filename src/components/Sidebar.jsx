import React, { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const role = localStorage.getItem('userRole')

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }

        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    if (!role) {
        return null
    }

    return (
        <>
            <div
                className={`fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden ${isOpen ? 'block' : 'hidden'}`}
                onClick={toggleSidebar}
            />
            <aside
                className={`fixed top-0 left-0 h-screen w-64 bg-[#ED1C24] lg:pt-16 pt-6 z-40 transform transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                <div className="h-full overflow-y-auto pb-20" style={{scrollbarWidth: 'none'}}>
                    <div className="flex justify-end px-4 lg:hidden mb-2">
                        <button onClick={toggleSidebar} className="text-white text-2xl">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>
                    <ul className="w-full text-left">
                        {role === 'Super Admin' ? (
                            <>
                                <li>
                                    <NavLink
                                        to="/manage-users"
                                        className={({ isActive }) =>
                                            isActive
                                                ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                        }
                                    >
                                        Manage Users
                                    </NavLink>
                                </li>
                                <li>
                                    <hr className="border-red-500" />
                                    <NavLink
                                        to="/reimbursement/cek-pengajuan"
                                        className={({ isActive }) =>
                                            isActive
                                                ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                        }
                                    >
                                        Cek Reimbursement
                                    </NavLink>
                                </li>
                                <li>
                                    <hr className="border-red-500" />
                                    <NavLink
                                        to="/create-bs/cek-pengajuan"
                                        className={({ isActive }) =>
                                            isActive
                                                ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                        }
                                    >
                                        Cek Bon Sementara
                                    </NavLink>
                                </li>
                                <li>
                                    <hr className="border-red-500" />
                                    <NavLink
                                        to="/lpj/cek-pengajuan"
                                        className={({ isActive }) =>
                                            isActive
                                                ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                        }
                                    >
                                        Cek LPJ Bon Sementara
                                    </NavLink>
                                </li>
                            </>
                        ) : (
                            <>
                                <li>
                                    <NavLink
                                        to={`/dashboard/${role}`}
                                        className={({ isActive }) =>
                                            isActive
                                                ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                        }
                                    >
                                        Dashboard
                                    </NavLink>
                                </li>
                                <li>
                                    <hr className="border-red-500" />
                                    {/* Menu Reimbursement */}
                                    <span className="block w-full py-2 pl-4 text-gray-100 text-xs font-semibold cursor-default">
                                        REIMBURSEMENT
                                    </span>
                                    <NavLink
                                        to="/reimbursement/bbm"
                                        className={({ isActive }) =>
                                            isActive
                                                ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                        }
                                    >
                                        BBM
                                    </NavLink>
                                    <NavLink
                                        to="/reimbursement/operasional"
                                        className={({ isActive }) =>
                                            isActive
                                                ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                        }
                                    >
                                        Operasional
                                    </NavLink>
                                    <NavLink
                                        to="/reimbursement/umum"
                                        className={({ isActive }) =>
                                            isActive
                                                ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                        }
                                    >
                                        GA/Umum
                                    </NavLink>
                                </li>
                                {(role === 'Reviewer' || role === 'Validator') && (
                                    <li>
                                        <NavLink
                                            to="/reimbursement/cek-pengajuan"
                                            className={({ isActive }) =>
                                                isActive
                                                    ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                    : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                            }
                                        >
                                            Cek Pengajuan
                                        </NavLink>
                                    </li>
                                )}
                                <li>
                                    <hr className="border-red-500" />
                                    {/* Menu Create Bon Sementara */}
                                    <span className="block w-full py-2 pl-4 text-gray-100 text-xs font-semibold cursor-default">
                                        BON SEMENTARA
                                    </span>
                                    <li>
                                        <NavLink
                                            to="/create-bs/create"
                                            className={({ isActive }) =>
                                                isActive
                                                    ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                    : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                            }
                                        >
                                            Ajukan Bon Sementara
                                        </NavLink>
                                    </li>
                                    {(role === 'Reviewer' || role === 'Validator') && (
                                        <li>
                                            <NavLink
                                                to="/create-bs/cek-pengajuan"
                                                className={({ isActive }) =>
                                                    isActive
                                                        ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                        : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                                }
                                            >
                                                Cek Pengajuan
                                            </NavLink>
                                        </li>
                                    )}

                                    <hr className="border-red-500" />
                                    {/* Menu LPJ Bon Sementara */}
                                    <span className="block w-full py-2 pl-4 text-gray-100 text-xs font-semibold cursor-default">
                                        LPJ BON SEMENTARA
                                    </span>
                                    <NavLink
                                        to="/lpj/umum"
                                        className={({ isActive }) =>
                                            isActive
                                                ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                        }
                                    >
                                        GA/Umum
                                    </NavLink>
                                    <NavLink
                                        to="/lpj/marketing"
                                        className={({ isActive }) =>
                                            isActive
                                                ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                        }
                                    >
                                        Marketing/Operasional
                                    </NavLink>
                                </li>
                                {(role === 'Reviewer' || role === 'Validator') && (
                                    <li>
                                        <NavLink
                                            to="/lpj/cek-pengajuan"
                                            className={({ isActive }) =>
                                                isActive
                                                    ? 'block w-full py-2 pl-8 text-white bg-[#FF5B5F]'
                                                    : 'block w-full py-2 pl-8 text-white hover:bg-[#FF5B5F]'
                                            }
                                        >
                                            Cek Pengajuan
                                        </NavLink>
                                    </li>
                                )}
                            </>
                        )}
                    </ul>
                </div>
            </aside>
        </>
    )
}

export default Sidebar
