import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import ClipLoader from "react-spinners/ClipLoader";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels);

const GAUBarChart = ({ selectedType, selectedMonth, selectedYear, months, onClose }) => {
    const [chartData, setChartData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (onClose) {
            document.body.style.overflow = 'hidden';

            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [onClose]);

    const baseColors = [
        "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#FF9F40", "#9966FF",
        "#FFB6C1", "#8B4513", "#00BFFF", "#32CD32", "#FFD700", "#8A2BE2",
        "#FF6347", "#9ACD32", "#DC143C", "#FF1493", "#00FF7F", "#7FFF00",
        "#1E90FF", "#D2691E", "#8FBC8F", "#FF4500", "#ADFF2F", "#6495ED",
        "#BA55D3", "#87CEEB", "#9370DB", "#3CB371", "#FF69B4", "#40E0D0",
        "#4682B4", "#DA70D6", "#708090", "#2E8B57", "#FFA07A", "#6A5ACD",
        "#20B2AA", "#5F9EA0", "#FFDAB9", "#EE82EE", "#F08080", "#98FB98"
    ];

    const getColor = (index) => baseColors[index % baseColors.length];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "reimbursement"));
                const data = querySnapshot.docs.map((doc) => ({
                    ...doc.data(),
                    id: doc.id,
                }));

                const filteredData = data.filter((item) => {
                    const pengajuanDate = new Date(item.tanggalPengajuan);
                    const itemMonth = pengajuanDate.getMonth() + 1;
                    const itemYear = pengajuanDate.getFullYear();

                    const monthMatch = selectedMonth.value === "all" || itemMonth === parseInt(selectedMonth.value);
                    const yearMatch = selectedYear.value === "all" || itemYear === parseInt(selectedYear.value);

                    return (
                        item.kategori === "GA/Umum" &&
                        item.reimbursements.some(r => {
                            const normalizedJenis = r.jenis.trim().toLowerCase();
                            const normalizedSelectedType = selectedType.trim().toLowerCase();
                            return normalizedJenis === normalizedSelectedType;
                        }) &&
                        monthMatch &&
                        yearMatch
                    );
                });

                const flattenedData = filteredData.flatMap(item =>
                    item.reimbursements.filter(r => {
                        const normalizedJenis = r.jenis.trim().toLowerCase();
                        const normalizedSelectedType = selectedType.trim().toLowerCase();
                        return normalizedJenis === normalizedSelectedType;
                    })
                );

                setChartData(flattenedData);
            } catch (error) {
                console.error("Error fetching data from Firestore:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (selectedType) {
            fetchData();
        }
    }, [selectedType, selectedMonth, selectedYear]);

    const prepareChartData = () => {
        if (!chartData) return null;

        const itemCounts = chartData.reduce((acc, reimb) => {
            const itemName = reimb.item
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            acc[itemName] = (acc[itemName] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(itemCounts).map(item =>
            item.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
        );
        const values = Object.values(itemCounts);

        const backgroundColors = values.map((_, index) => getColor(index));

        return {
            labels,
            datasets: [
                {
                    label: 'Jumlah Item',
                    data: values,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors,
                    borderWidth: 1,
                },
            ],
        };
    };

    const chartDisplayData = prepareChartData();

    if (isLoading || !chartData) {
        return (
            <div className="flex justify-center items-center h-96">
                <ClipLoader color="#ED1C24" size={60} />
            </div>
        );
    }

    const getPeriodText = () => {
        const monthName = selectedMonth.value === "all"
            ? "Semua Bulan"
            : months.find(m => m.value === selectedMonth.value)?.label;
        const yearText = selectedYear.value === "all"
            ? "Semua Tahun"
            : selectedYear.value;
        return `${monthName} ${yearText}`;
    };

    return (
        <div className="w-full h-[80vh] md:h-[75vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between w-full mb-4">
                <h2 className="text-base md:text-lg font-medium">
                    Detail Item {selectedType} - {getPeriodText()}
                </h2>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-800 text-4xl"
                    >
                        &times;
                    </button>
                )}
            </div>
            <div className="flex-1 min-h-0 overflow-auto scrollbar">
                <div className="min-h-[200px] h-full">
                    {chartDisplayData && chartDisplayData.labels.length > 0 ? (
                        <Bar
                            data={chartDisplayData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        display: false,
                                    },
                                    datalabels: {
                                        color: '#fff',
                                        font: {
                                            weight: 'bold',
                                            size: 12
                                        },
                                    },
                                },
                                scales: {
                                    x: {
                                        title: {
                                            display: true,
                                            text: "Item",
                                            font: {
                                                size: 10,
                                            }
                                        },
                                        ticks: {
                                            maxRotation: 45,
                                            font: {
                                                size: 10,
                                            }
                                        },
                                    },
                                    y: {
                                        title: {
                                            display: true,
                                            text: "Jumlah",
                                            font: {
                                                size: 10,
                                            }
                                        },
                                        ticks: {
                                            stepSize: 2,
                                            precision: 0,
                                            beginAtZero: true,
                                            font: {
                                                size: 10,
                                            }
                                        },
                                    },
                                },
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-sm sm:text-base md:text-lg text-gray-500 text-center px-4">
                                Tidak ada data untuk {selectedType} pada periode {getPeriodText()}.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GAUBarChart;