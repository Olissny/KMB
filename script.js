document.getElementById('theme-toggle').addEventListener('change', function () {
    document.documentElement.classList.toggle('dark-mode');
});

const routeAPI = 'https://data.etabus.gov.hk/v1/transport/kmb/route/';
const routeStopAPI = 'https://data.etabus.gov.hk/v1/transport/kmb/route-stop';
const stopAPI = 'https://data.etabus.gov.hk/v1/transport/kmb/stop';


document.addEventListener('DOMContentLoaded', function () {
    const submitBtn = document.getElementById('submitBtn');
    const userInput = document.getElementById('userInput');

    submitBtn.addEventListener('click', handleSubmit);
    userInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    });

    async function handleSubmit() {
        const boundContainer = document.getElementById('bound');
        boundContainer.innerHTML = '';
        const routeContainer = document.getElementById('route-container');
        routeContainer.innerHTML = '';
        hideError();

        const busRoute = userInput.value.trim().replaceAll(' ', '').toUpperCase();
        userInput.value = busRoute;

        const regex = new RegExp(/^[a-zA-Z0-9]*$/);
        if (regex.test(busRoute)) {
            try {
                const routes = await checkRouteExist(busRoute);
                boundContainer.textContent = '請選擇路線：';
                routes.forEach(route => {
                    const boundBtn = createBoundBtn(route);
                    boundContainer.appendChild(boundBtn);
                });
            } catch (err) {
                console.log(err);
                showError(err);
            }
        } else {
            showError(`請輸入正確巴士路線！`);
        }
    }
});
async function checkRouteExist(input) {
    const res = await fetch(routeAPI);
    const results = await res.json();
    if (results) { 
        const busRoutes = [];
        for (let i = 0; i < results['data'].length; i++) {
            const eachRoute = results['data'][i];
            if (eachRoute.route == input) {
                busRoutes.push(eachRoute);
            }
        }
        if (busRoutes.length > 0) {
            
            return busRoutes; 
        } else {
            alert('請輸入正確路線');
            return Promise.reject('');
        }
    } else {
        alert('Server Error'); 
        return Promise.reject('');
    }
}

async function getETA(stopId, route, serviceType) {
    try {
        const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/eta/${stopId}/${route}/${serviceType}`);
        const etaData = await res.json();
        return etaData;
    } catch (err) {
        console.error('Error fetching ETA data:', err);
        return null;
    }
}
let currentlySelectedBtn = null;

function createBoundBtn(route) {
    const boundBtn = document.createElement('button');
    boundBtn.classList.add('boundBtn');
    boundBtn.textContent = `${route.orig_tc} ➤ ${route.dest_tc}`;
    boundBtn.setAttribute('data-bound', route.bound == "O" ? 'outbound' : 'inbound');
    boundBtn.setAttribute('data-route', route.route);
    boundBtn.setAttribute('data-type', route.service_type);

    boundBtn.addEventListener('click', async function () {
        if (currentlySelectedBtn) {
            currentlySelectedBtn.classList.remove('selected');
        }

        this.classList.add('selected');

        currentlySelectedBtn = this;

        const routeContainer = document.getElementById('route-container');
        routeContainer.innerHTML = '';
        showLoading();
        const routeNum = this.getAttribute('data-route');
        const routeBound = this.getAttribute('data-bound');
        const routeType = this.getAttribute('data-type');
        console.log(routeBound);
        const res = await fetch(`${routeStopAPI}/${routeNum}/${routeBound}/${routeType}`);
        const routeData = await res.json();
        await renderRouteList(routeData.data, routeBound);
        const stopId = routeData.data[0].stop;
        const etaData = await getETA(stopId, routeNum, routeType);
        if (etaData) {
            const firstEta = etaData.data[0].eta;      
        } else {
            showError('server down');
        }
    });
    return boundBtn;
}

const etaContainer = document.createElement('div');
etaContainer.classList.add('etaContainer'); 

let currentlyOpenStop = null;
let currentlySelectedButton = null; 

async function renderRouteList(routeDataArr, routeBound) {
    const routeContainer = document.getElementById('route-container');
    const routeList = document.createElement('ul');
    routeList.classList.add('routeList');

    for (let i = 0; i < routeDataArr.length; i++) {
        const stopId = routeDataArr[i].stop;
        const res = await fetch(`${stopAPI}/${stopId}`);
        const results = await res.json();
        const stopName = results.data.name_tc;
        const li = document.createElement('li');
        const stopBtn = document.createElement('button');
        stopBtn.textContent = `${routeDataArr[i].seq}    ${stopName}`;
        stopBtn.classList.add('stopBtn');
        stopBtn.addEventListener('click', async () => {
            showLoading();
            const routeNum = routeDataArr[i].route;
            const routeType = routeDataArr[i].service_type;
            const etaData = await getETA(stopId, routeNum, routeType);

            if (etaData) {
                const filteredETAs = etaData.data.filter((eta) => eta.dir === routeBound.charAt(0).toUpperCase()); // Filter by routeBound
                const now = new Date();

                const stopEtaContainer = document.createElement('div');
                stopEtaContainer.classList.add('stopEtaContainer');

                for (const eta of filteredETAs) {
                    const etaTime = new Date(eta.eta);
                    const minutesFromNow = Math.floor((etaTime - now) / (1000 * 60));
                    const minutes = minutesFromNow % 60;
                    const formattedEtaTime = etaTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                    const etaText = document.createElement('span');
                    etaText.innerHTML = `${formattedEtaTime}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(${minutes} 分鐘)`;

                    const etaParagraph = document.createElement('p');
                    etaParagraph.appendChild(etaText);

                    stopEtaContainer.appendChild(etaParagraph);
                }

                if (currentlyOpenStop && currentlyOpenStop !== li) {
                    const previousEtaContainer = currentlyOpenStop.querySelector('.stopEtaContainer');
                    if (previousEtaContainer) {
                        previousEtaContainer.remove();
                    }
                }

                // Clear any existing ETA data for this stop
                const existingEtaContainer = li.querySelector('.stopEtaContainer');
                if (existingEtaContainer) {
                    existingEtaContainer.remove();
                }

                // Append the stopEtaContainer to the li element
                li.appendChild(stopEtaContainer);

                // Update the currently open stop
                currentlyOpenStop = li;

                // Handle the button selection state
                if (currentlySelectedButton) {
                    currentlySelectedButton.classList.remove('selectedStopBtn');
                }
                stopBtn.classList.add('selectedStopBtn');
                currentlySelectedButton = stopBtn;
            } else {
                showError('獲取 ETA 數據時出錯。');
            }

            hideLoading();
        });
        li.appendChild(stopBtn);
        routeList.appendChild(li);
    }
    hideLoading();
    routeContainer.appendChild(routeList);
}

function showLoading() {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
}

function hideLoading() {
    const loading = document.getElementById('loading');
    loading.style.display = 'none';
}

function showError(err) {
    const error = document.getElementById('error');
    error.textContent = err;
    error.style.display = 'block';
}

function hideError() {
    const error = document.getElementById('error');
    error.textContent = '';
    error.style.display = 'none';
}

