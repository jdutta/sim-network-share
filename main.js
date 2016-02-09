$(document).ready(function () {

    var config = {
        width: 700,
        height: 600,
        nodeRadius: 3,
        linkColor: '#ccc',
        nodeColor: '#999',
        toVisitNodeColor: '#ffbb42',
        visitedNodeColor: '#ff3300'
    };

    var datGuiParams = {
        numNodes: 100,
        simSpeed: 2,
        gravity: 0.15,
        togglePlayPause: function () {},
        restart: function () {}
    };

    function addParamsGui() {
        var gui = new dat.GUI();
        var numNodesCtrl = gui.add(datGuiParams, 'numNodes', 20, 500).step(10);
        var gravityCtrl = gui.add(datGuiParams, 'gravity', 0.05, 0.75).step(0.1);
        var simSpeedCtrl = gui.add(datGuiParams, 'simSpeed', { '1 fps': 1, '2 fps': 2, '4 fps': 4 } );
        gui.add(datGuiParams, 'togglePlayPause');
        gui.add(datGuiParams, 'restart');
        gui.open();

        numNodesCtrl.onFinishChange(function () {
            datGuiParams.restart();
        });

        gravityCtrl.onFinishChange(function () {
            datGuiParams.restart();
        });

        simSpeedCtrl.onFinishChange(function () {
            datGuiParams.restart();
        });
    }

    function init() {
        addParamsGui();
        generateNodesLinksAndVisualize();
    }

    function generateNodesLinksAndVisualize() {
        var nodes = generateNodes(datGuiParams.numNodes);
        var links = generateLinks(nodes, 3);
        var shareSim = shareSimulation(nodes);
        datGuiParams.togglePlayPause = shareSim.toggle;
        datGuiParams.restart = function () {
            shareSim.reset(); // TODO dispose shareSim, nodes, links
            generateNodesLinksAndVisualize();
        };
        visualize(nodes, links, shareSim);
    }

    // [0, n)
    function getRandInt(n) {
        return Math.floor(Math.random() * n);
    }

    function generateNodes(n) {
        var nodes = [];
        for (var i=0; i<n; i++) {
            nodes.push({
                id: i,
                conn: [],
                payload: {}
            });
        }
        return nodes;
    }

    function generateLinks(nodes, maxLinksPerNode) {
        var links = [];

        var n = nodes.length;
        for (var i=0; i<n; i++) {
            var node = nodes[i];
            if (node.conn.length < maxLinksPerNode) {
                var numLinks = getRandInt(maxLinksPerNode-node.conn.length) + 1;
                for (var j=0; j<numLinks; j++) {
                    var connNodeId = getRandInt(n);
                    while (connNodeId === node.id || node.conn.indexOf(connNodeId) > -1) {
                        connNodeId = getRandInt(n);
                    }
                    if (nodes[connNodeId].conn.length < maxLinksPerNode) {
                        node.conn.push(connNodeId);
                        nodes[connNodeId].conn.push(node.id);
                        links.push({
                            source: node,
                            target: nodes[connNodeId]
                        });
                    }
                }
            }
        }

        return links;
    }

    function visualize(nodes, links, shareSim) {

        var svg = d3.select('svg');
        svg.select('*').remove(); // remove old cruft

        var gRoot = svg.append('svg:g')
            .attr('transform', 'translate(0, 50)');
        var node = gRoot.selectAll('.node');
        var link = gRoot.selectAll('.link');

        var line = d3.svg.line()
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; });

        var force = d3.layout.force()
            .nodes(nodes)
            .links(links)
            .size([config.width, config.height])
            .gravity(datGuiParams.gravity)
            .charge(function (d, i) {
                return -100;
            })
            .on('tick', tick)
            .start();

        link = link.data(links)
            .enter()
            .append('svg:line')
            .classed('link', true)
            .style('stroke', config.linkColor)
            .attr('x1', function(d) { return d.source.x; })
            .attr('y1', function(d) { return d.source.y; })
            .attr('x2', function(d) { return d.target.x; })
            .attr('y2', function(d) { return d.target.y; });

        node = node.data(nodes)
            .data(nodes)
            .enter()
            .append('svg:g')
            .attr('class', 'node')
            .attr('transform', function (d) { return 'translate('+[d.x, d.y] +')'; })
            .call(force.drag);

        node.append('svg:circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', function (d) {
                return config.nodeRadius;
            });
        node.style('fill', function (d) {
            if (!d.id) {
                return config.visitedNodeColor;
            }
            return config.nodeColor;
        })
            .style('stroke-width', 3);


        function tick(e) {
            if (e.alpha < 0.001) {
                force.stop();
                return;
            }

            node.attr('transform', function (d) { return 'translate('+[d.x, d.y] +')'; });
            link.attr('x1', function(d) { return d.source.x; })
                .attr('y1', function(d) { return d.source.y; })
                .attr('x2', function(d) { return d.target.x; })
                .attr('y2', function(d) { return d.target.y; });
        }

        function updateSimProgress(nodesToVisitNow, visitedNodes) {
            console.log('update sim progress', nodesToVisitNow);
            node.style('stroke', function (d) {
                if (nodesToVisitNow[d.id]) {
                    return config.toVisitNodeColor;
                }
            });
            node.style('fill', function (d) {
                if (visitedNodes[d.id]) {
                    return config.visitedNodeColor;
                }
                return config.nodeColor;
            });
            link.style('stroke', function (d) {
                if ((nodesToVisitNow[d.target.id] && visitedNodes[d.source.id]) || (nodesToVisitNow[d.source.id]) && visitedNodes[d.target.id]) {
                    return config.toVisitNodeColor;
                } else if (visitedNodes[d.target.id] || visitedNodes[d.source.id]) {
                    return config.visitedNodeColor;
                }
                return config.linkColor;
            });
        }
        shareSim.addUpdateCallback(updateSimProgress);
    }

    function shareSimulation(nodes) {
        var running = false;
        var timer = null;
        var updateCallbackFn = function () {};

        var visitedNodes = {};
        var nodesToVisitNow = {0: true};
        function oneStep() {
            var toVisitNext = {};
            for (var nodeId in nodesToVisitNow) {
                visitedNodes[nodeId] = true;
                nodes[nodeId].conn.forEach(function (connNodeId) {
                    if (!visitedNodes[connNodeId] && !nodesToVisitNow[connNodeId] && !toVisitNext[connNodeId]) {
                        toVisitNext[connNodeId] = true;
                    }
                });
            }
            nodesToVisitNow = toVisitNext;
        }

        function reset() {
            visitedNodes = {};
            nodesToVisitNow = {};
        }

        function toggle() {
            running = !running;
            if (running && Object.keys(nodesToVisitNow).length > 0) {
                timer = setInterval(function () {
                    oneStep();
                    updateCallbackFn(nodesToVisitNow, visitedNodes);
                    if (!Object.keys(nodesToVisitNow).length) {
                        clearTimeout(timer);
                    }
                }, 1000/(+datGuiParams.simSpeed));
            } else {
                clearTimeout(timer);
            }
        }

        return {
            addUpdateCallback: function (fn) {
                updateCallbackFn = fn;
            },
            reset: reset,
            toggle: toggle
        }
    }

    init();
});
