import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import Select from "react-select";
import GAUBarChart from './GAUBarChart';
import GAUComparisonChart from "./GAUComparisonBarChart";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

const GAUPieChart = () => {
    const [chartData, setChartData] = useState(null);
    const [rawData, setRawData] = useState([]);
    const [lpjData, setLpjData] = useState([]);
    const [reimbursementData, setReimbursementData] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState({ value: "all", label: "Semua Bulan" });
    const [selectedYear, setSelectedYear] = useState({ value: "all", label: "Semua Tahun" });
    const [availableYears, setAvailableYears] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    const [showLPJ, setShowLPJ] = useState(false);
    const [loading, setLoading] = useState(true)

    const months = [
        { value: "all", label: "Semua Bulan" },
        { value: "1", label: "Januari" },
        { value: "2", label: "Februari" },
        { value: "3", label: "Maret" },
        { value: "4", label: "April" },
        { value: "5", label: "Mei" },
        { value: "6", label: "Juni" },
        { value: "7", label: "Juli" },
        { value: "8", label: "Agustus" },
        { value: "9", label: "September" },
        { value: "10", label: "Oktober" },
        { value: "11", label: "November" },
        { value: "12", label: "Desember" }
    ];

    const handleChartClick = (event) => {
        const chart = event.chart;
        const activePoints = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true });

        if (activePoints.length > 0) {
            const index = activePoints[0].index;
            const label = chart.data.labels[index];
            const actualType = label.split(' (')[0];
            setSelectedCategory(actualType);
            setIsModalOpen(true);
        }
    };

    const predefinedTypes = {
        ATK: "rgba(255, 99, 132, 1)",
        RTG: "rgba(54, 162, 235, 1)",
        Entertaint: "rgba(255, 206, 86, 1)",
        Parkir: "rgba(75, 192, 192, 1)",
        "Meals Lembur": "rgba(153, 102, 255, 1)",
        "Meals Meeting": "rgba(255, 159, 64, 1)",
        "Jenis Lain": "rgba(201, 203, 207, 1)",
    };

    // Function to normalize type names
    const normalizeTypeName = (type) => {
        if (!type) return "Jenis Lain";

        // If it's a predefined type (case-insensitive check)
        const predefinedType = Object.keys(predefinedTypes).find(
            key => key.toLowerCase() === type.toLowerCase()
        );
        if (predefinedType) return predefinedType;

        return type
            .toLowerCase()
            .replace(/\s+/g, ' ')    // Replace multiple spaces with single space
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getColor = (type, index) => {
        // First check if it's a predefined type (case-insensitive)
        const predefinedType = Object.keys(predefinedTypes).find(
            key => key.toLowerCase() === type.toLowerCase()
        );
        if (predefinedType) {
            return predefinedTypes[predefinedType];
        }

        // For custom types, use the baseColors array
        const baseColors = [
            "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#FF9F40", "#9966FF",
            "#FFB6C1", "#8B4513", "#00BFFF", "#32CD32", "#FFD700", "#8A2BE2",
            "#FF6347", "#9ACD32", "#DC143C", "#FF1493", "#00FF7F", "#7FFF00",
            "#1E90FF", "#D2691E", "#8FBC8F", "#FF4500", "#ADFF2F", "#6495ED",
            "#BA55D3", "#87CEEB", "#9370DB", "#3CB371", "#FF69B4", "#40E0D0",
            "#4682B4", "#DA70D6", "#708090", "#2E8B57", "#FFA07A", "#6A5ACD",
            "#20B2AA", "#5F9EA0", "#FFDAB9", "#EE82EE", "#F08080", "#98FB98"
        ];
        return baseColors[index % baseColors.length];
    };

    const updateChartData = (month, year) => {
        const dataItems = showLPJ ? lpjData : reimbursementData;

        if (!dataItems.length) {
            setChartData({
                labels: [],
                datasets: [],
            });
            return;
        }

        const filteredData = dataItems.filter(item => {
            if (item.kategori !== "GA/Umum") return false;

            const date = new Date(item.tanggalPengajuan);
            const itemYear = date.getFullYear();
            const itemMonth = date.getMonth() + 1;

            return (
                (year.value === "all" || itemYear === parseInt(year.value)) &&
                (month.value === "all" || itemMonth === parseInt(month.value))
            );
        });

        if (!filteredData.length) {
            setChartData({
                labels: [],
                datasets: [],
            });
            return;
        }

        let groupedData;

        if (showLPJ) {
            // Process LPJ data
            groupedData = filteredData.reduce((acc, item) => {
                if (!item.lpj?.length) return acc;
                item.lpj.forEach(lpjItem => {
                    const normalizedItem = normalizeTypeName(lpjItem.namaItem);
                    const jumlah = lpjItem.jumlah || 1;

                    if (!acc[normalizedItem]) acc[normalizedItem] = 0;
                    acc[normalizedItem] += jumlah;
                });
                return acc;
            }, {});
        } else {
            // Process reimbursement data
            groupedData = filteredData.reduce((acc, item) => {
                if (!item.reimbursements?.length) return acc;
                item.reimbursements.forEach(reimb => {
                    const normalizedType = normalizeTypeName(reimb.jenis);
                    if (!acc[normalizedType]) acc[normalizedType] = 0;
                    acc[normalizedType] += 1;
                });
                return acc;
            }, {});
        }

        const labels = Object.keys(groupedData);
        const values = Object.values(groupedData);

        const labelWithCount = labels.map((label, index) => {
            const count = values[index];
            return `${label} (${count})`;
        });

        const backgroundColors = labels.map((label, index) => getColor(label, index));

        setChartData({
            labels: labelWithCount,
            datasets: [
                {
                    label: showLPJ ? "Jumlah Item" : "Jumlah Pengajuan",
                    data: values,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors,
                    borderWidth: 1,
                },
            ],
        });
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)

            try {              
                // Fetch reimbursement data (hanya yang Disetujui)
                const reimbQuery = query(collection(db, "reimbursement"), where("status", "==", "Disetujui"));
                const reimbQuerySnapshot = await getDocs(reimbQuery);
                const reimbData = reimbQuerySnapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id
                }));
                setReimbursementData(reimbData);

                // Fetch LPJ data (hanya yang Disetujui)
                const lpjQuery = query(collection(db, "lpj"), where("status", "==", "Disetujui"));
                const lpjQuerySnapshot = await getDocs(lpjQuery);
                const lpjFetchedData = lpjQuerySnapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id
                }));
                setLpjData(lpjFetchedData);

                const combinedData = [...reimbData, ...lpjFetchedData];

                const years = [...new Set(combinedData.map(item =>
                    new Date(item.tanggalPengajuan).getFullYear()
                ))].sort((a, b) => b - a);

                const yearOptions = years.map(year => ({
                    value: year.toString(),
                    label: year.toString(),
                }));

                setAvailableYears(yearOptions);
                setRawData(combinedData)

                if (years.length > 0) {
                    const initialYear = yearOptions[0];
                    setSelectedYear(initialYear);
                    updateChartData(reimbData, lpjFetchedData, selectedMonth, initialYear);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false)
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        updateChartData(selectedMonth, selectedYear);
    }, [selectedMonth, selectedYear, showLPJ, reimbursementData, lpjData]);

    useEffect(() => {
        const years = reimbursementData.concat(lpjData).reduce((acc, item) => {
            const date = new Date(item.tanggalPengajuan);
            const year = date.getFullYear();
            if (!acc.includes(year)) acc.push(year);
            return acc;
        }, []);
        setAvailableYears(years.map((year) => ({ value: year.toString(), label: year.toString() })));
    }, [reimbursementData, lpjData]);

    const handleMonthChange = (option) => {
        setSelectedMonth(option);
        updateChartData(option, selectedYear);
    };

    const handleYearChange = (option) => {
        setSelectedYear(option);
        updateChartData(selectedMonth, option);
    };

    const handleToggleChange = (isLPJ) => {
        setShowLPJ(isLPJ);
    };

    const selectStyles = {
        control: (base) => ({
            ...base,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderColor: '#e5e7eb',
            fontSize: '12px',
            height: '32px',
            padding: '0 4px',
            lineHeight: 'normal',
            '&:hover': {
                borderColor: '#3b82f6'
            },
            borderRadius: '8px'
        }),
        menu: (base) => ({
            ...base,
            zIndex: 100
        }),
        option: (base) => ({
            ...base,
            fontSize: '12px',
            padding: '6px 12px',
            cursor: 'pointer'
        })
    };

    return (
        <div className="bg-white px-6 py-4 flex flex-col w-full shadow-sm rounded-lg">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <h2 className="text-xl font-medium">
                    {showLPJ ? "Pengajuan GA/Umum (LPJ BS)" : "Pengajuan GA/Umum (Reimbursement)"}
                </h2>
                {loading ? (
                    <Skeleton width={100} height={20} />
                ) : (
                    <div
                        className="text-red-500 hover:text-red-600 text-sm font-semibold underline cursor-pointer"
                        onClick={() => setIsComparisonModalOpen(true)}
                    >
                        Lihat Perbandingan
                    </div>
                )}
            </div>

            <hr className="border-gray-100 my-2" />

            <div className="flex flex-col w-full h-full gap-4 xl:gap-2">
                <div className="flex flex-col md:flex-row xl:flex-row justify-between items-center gap-2">
                    <label className="w-full md:w-64 xl:w-52 cursor-pointer">
                        {loading ? (
                            <Skeleton height={32} />
                        ) : (
                            <div className="w-full bg-gray-100 p-1 rounded-full">
                                <div className="flex items-center">
                                    <div
                                        onClick={() => handleToggleChange(false)}
                                        className={`flex-1 text-center text-xs p-2 rounded-full cursor-pointer transition-all duration-300 
                                            ${!showLPJ ? 'bg-red-600 text-white' : 'bg-transparent text-gray-700'}`}
                                    >
                                        Reimbursement
                                    </div>
                                    <div
                                        onClick={() => handleToggleChange(true)}
                                        className={`flex-1 text-center text-xs p-2 rounded-full cursor-pointer transition-all duration-300 
                                            ${showLPJ ? 'bg-red-600 text-white' : 'bg-transparent text-gray-700'}`}
                                    >
                                        LPJ BS
                                    </div>
                                </div>
                            </div>
                        )}
                    </label>

                    <div className="flex flex-row md:flex-row gap-2 w-full md:w-auto lg:w-80 xl:w-72">
                        {loading ? (
                            <>
                                <Skeleton width={150} height={32} />
                                <Skeleton width={150} height={32} />
                            </>
                        ) : (
                            <>
                                <Select
                                    className="w-full md:w-36 lg:w-full"
                                    value={selectedMonth}
                                    onChange={handleMonthChange}
                                    options={months}
                                    styles={selectStyles}
                                    isSearchable={false}
                                />
                                <Select
                                    className="w-full md:w-36 lg:w-full"
                                    value={selectedYear}
                                    onChange={handleYearChange}
                                    options={[{ value: "all", label: "Semua Tahun" }, ...availableYears]}
                                    styles={selectStyles}
                                    isSearchable={false}
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* Chart Area */}
                <div className="flex-1 h-[300px] xl:h-full">
                    {loading ? (
                        <div className="flex justify-center align-center">
                            <Skeleton width={280} height={280} circle />
                        </div>
                    ) : (
                        chartData ? (
                            chartData.labels.length === 0 ? (
                                <div className="w-full h-40 xl:h-full flex justify-center items-center">
                                    <p className="text-gray-500 text-sm text-center px-4">
                                        {showLPJ ? "Tidak ada pengajuan LPJ Bon Sementara GA/Umum" : "Tidak ada pengajuan Reimbursement GA/Umum"} untuk periode yang dipilih
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col md:flex-row h-auto max-h-[320px] md:max-h-[240px] xl:max-h-[280px]">
                                    <div className="relative flex justify-center items-center w-full md:w-1/2 xl:w-3/5 h-[240px] xl:h-[280px]">
                                        <Pie
                                            data={chartData}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: true,
                                                plugins: {
                                                    legend: {
                                                        display: false
                                                    },
                                                    datalabels: {
                                                        formatter: (value, ctx) => {
                                                            if (showLPJ) return '';
                                                            const dataset = ctx.chart.data.datasets[0];
                                                            const total = dataset.data.reduce((acc, data) => acc + data, 0);
                                                            const percentage = ((value / total) * 100).toFixed(1);
                                                            return `${percentage}%`;
                                                        },
                                                        color: '#fff',
                                                        font: {
                                                            weight: 'bold',
                                                            size: 10,
                                                        },
                                                        textAlign: 'center',
                                                        display: function (context) {
                                                            if (showLPJ) return false;
                                                            const dataset = context.dataset;
                                                            const value = dataset.data[context.dataIndex];
                                                            return value > 0;
                                                        },
                                                    },
                                                },
                                                onClick: !showLPJ ? handleChartClick : undefined,
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 md:mt-0 md:ml-2 overflow-x-auto overflow-y-hidden md:overflow-y-auto md:overflow-x-hidden px-2 w-full md:w-3/5 xl:w-4/5 scrollbar">
                                        <div className="grid grid-rows-2 auto-cols-max grid-flow-col md:grid-flow-row md:grid-rows-none md:grid-cols-2 gap-2 p-2 xl:p-1">
                                            {chartData.labels.map((label, index) => (
                                                <div key={label} className="flex items-center gap-2 whitespace-nowrap md:whitespace-normal">
                                                    <span
                                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: chartData.datasets[0].backgroundColor[index] }}
                                                    />
                                                    <span className="text-xs">{label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="flex justify-center align-center">
                                <Skeleton width={200} height={200} circle />
                            </div>
                        )
                    )}
                </div>
            </div>

            {isComparisonModalOpen && (
                <div
                    className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setIsComparisonModalOpen(false);
                        }
                    }}
                    style={{ width: '100%', height: '100%' }}
                >
                    <div className="bg-white rounded-lg shadow-lg px-4 lg:px-6 py-4 md:py-6 relative w-11/12 max-w-6xl">
                        <GAUComparisonChart
                            rawData={rawData}
                            selectedYear={selectedYear}
                            onClose={() => setIsComparisonModalOpen(false)}
                            data={{ reimbursementData, lpjData }}
                            showLPJ={showLPJ}
                        />
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div
                    className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setIsModalOpen(false);
                        }
                    }}
                    style={{ width: '100%', height: '100%' }}
                >
                    <div className="bg-white rounded-lg shadow-lg px-4 lg:px-6 py-4 md:py-6 relative w-11/12 max-w-6xl">
                        <GAUBarChart
                            selectedType={selectedCategory}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                            onClose={() => setIsModalOpen(false)}
                            months={months}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default GAUPieChart;